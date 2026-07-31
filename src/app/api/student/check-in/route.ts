import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import { isStudentAutoOff } from "@/lib/meal-utils"

// A custom webhook caller just for appending logs to the Google Sheet
async function triggerGoogleSheetAppend(logData: any) {
  const syncUrl = process.env.GOOGLE_SCRIPT_SCAN_LOG_URL;
  if (!syncUrl) return;

  try {
    await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "appendScanLog",
        data: logData
      }),
    });
  } catch (error) {
    console.error("Live sheet append error", error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized. Please log in as a student." }, { status: 401 })
    }

    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: "Missing QR token" }, { status: 400 })
    }

    // 1. Verify token
    const secret = process.env.AUTH_SECRET || "fallback_secret_for_dev_only"
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret)
    } catch (err) {
      return NextResponse.json({ error: "Invalid or expired QR code" }, { status: 400 })
    }

    const { date, mealType } = decoded
    if (!date || !mealType) {
      return NextResponse.json({ error: "Invalid QR code format" }, { status: 400 })
    }

    const scanDate = new Date(date)
    scanDate.setUTCHours(0,0,0,0)

    // 2. Find Student
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true }
    })
    
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 })
    }

    // 3. Find Active Period
    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })
    
    if (!activePeriod) {
      return NextResponse.json({ error: "No active dining period" }, { status: 400 })
    }

    // 4. Calculate if student is Auto-Off
    // We need their total deposits
    const deposits = await prisma.transaction.findMany({
      where: { studentId: student.id, type: { in: ["DEPOSIT", "REFUND"] } }
    })
    
    const sumTxs = deposits.reduce((sum, tx) => {
      return sum + (tx.type === "REFUND" ? -Math.abs(tx.amount) : tx.amount)
    }, 0)

    const { autoOff } = isStudentAutoOff(student.wallet?.balance || 0, activePeriod, new Date(), sumTxs)
    
    // Check custom schedule if not auto-off
    let isAuthorized = !autoOff
    let denyReason = autoOff ? "Auto-Off (Low Balance/Deposit)" : null

    if (isAuthorized) {
      const schedule = await prisma.mealSchedule.findFirst({
        where: {
          studentId: student.id,
          date: {
            gte: new Date(scanDate.setUTCHours(0,0,0,0)),
            lte: new Date(scanDate.setUTCHours(23,59,59,999))
          }
        }
      })
      if (schedule) {
        if (mealType === "LUNCH" && !schedule.lunch) {
          isAuthorized = false;
          denyReason = "Lunch is OFF today";
        }
        if (mealType === "DINNER" && !schedule.dinner) {
          isAuthorized = false;
          denyReason = "Dinner is OFF today";
        }
      }
    }

    // 5. Check if already scanned
    if (isAuthorized) {
      const existingScan = await prisma.mealCheckIn.findFirst({
        where: {
          studentId: student.id,
          date: scanDate,
          mealType: mealType,
          status: "AUTHORIZED"
        }
      })
      
      if (existingScan) {
        isAuthorized = false;
        denyReason = "Already Scanned";
      }
    }

    // 6. Record the scan log
    const status = isAuthorized ? "AUTHORIZED" : "DENIED"
    
    const checkIn = await prisma.mealCheckIn.create({
      data: {
        studentId: student.id,
        date: scanDate,
        mealType,
        status: status,
        reason: denyReason
      }
    })

    // 7. Push to Google Sheets Live Log
    const logData = {
      time: checkIn.createdAt.toISOString(),
      name: student.name,
      diningId: student.diningId,
      department: student.department,
      meal: mealType,
      status: status,
      reason: denyReason || ""
    }

    // Fire the webhook without blocking the main response too long, but await it 
    // to prevent Vercel freezing.
    await triggerGoogleSheetAppend(logData)

    return NextResponse.json({
      success: true,
      status: status,
      reason: denyReason,
      student: {
        name: student.name,
        photo: session.user.image,
        diningId: student.diningId,
        department: student.department
      }
    })

  } catch (error) {
    console.error("Student Check-In Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
