import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import jwt from "jsonwebtoken"
import { isStudentAutoOff, getStudentPeriodDeposit } from "@/lib/meal-utils"
import { getQrTokenSecret } from "@/lib/secrets"

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

    const { token, faceDescriptor } = await req.json()
    if (!token) {
      return NextResponse.json({ error: "Missing QR token" }, { status: 400 })
    }
    if (!faceDescriptor) {
      return NextResponse.json({ error: "Face verification is required. Please allow camera access and look at the camera." }, { status: 400 })
    }

    // 1. Verify token (same fail-closed secret the generator signs with).
    const secret = getQrTokenSecret()
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

    // 2. CHECK TIME (Strict boundaries just like Admin Scanner)
    const bdtString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const bdtDate = new Date(bdtString);
    const hour = bdtDate.getHours();
    const minute = bdtDate.getMinutes();
    
    const year = bdtDate.getFullYear();
    const month = String(bdtDate.getMonth() + 1).padStart(2, '0');
    const day = String(bdtDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Check if token date matches today
    if (date !== todayStr) {
      return NextResponse.json({ error: `This QR code is for ${date}, not today.` }, { status: 400 })
    }
    
    let currentMeal: "LUNCH" | "DINNER" | null = null;
    
    if (hour >= 10 && hour < 17) {
      currentMeal = "LUNCH";
    } else if (hour >= 19 && (hour < 23 || (hour === 23 && minute <= 30))) {
      currentMeal = "DINNER";
    }

    if (!currentMeal) {
      return NextResponse.json({ error: "No active meal service at this time. Lunch is 10AM-5PM, Dinner is 7PM-11:30PM." }, { status: 400 })
    }

    if (currentMeal !== mealType) {
      return NextResponse.json({ error: `You scanned a ${mealType} QR code during the ${currentMeal} period!` }, { status: 400 })
    }

    // 3. Find Student
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true, user: { select: { image: true } } }
    })
    
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 })
    }

    if (!student.isActive) {
      return NextResponse.json({ error: "Student account is inactive" }, { status: 403 })
    }

    if (!student.faceDescriptor) {
      return NextResponse.json({ error: "You must register your face in the profile page before checking in." }, { status: 403 })
    }

    // 3.5 Face Verification
    try {
      const storedDescriptor = JSON.parse(student.faceDescriptor) as number[]
      const liveDescriptor = JSON.parse(faceDescriptor) as number[]
      
      if (storedDescriptor.length !== 128 || liveDescriptor.length !== 128) {
        throw new Error("Invalid descriptor format")
      }
      
      const distance = Math.sqrt(
        storedDescriptor.reduce((acc, val, i) => acc + Math.pow(val - liveDescriptor[i], 2), 0)
      )

      if (distance > 0.55) {
        await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_FACE`, details: "Face verification failed." }})
        return NextResponse.json({ error: "Face verification failed. Please try again." }, { status: 403 })
      }
    } catch (err) {
      return NextResponse.json({ error: "Face verification error. Please ensure your face is registered properly." }, { status: 400 })
    }

    // 4. Find Active Period
    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })
    
    if (!activePeriod) {
      return NextResponse.json({ error: "No active dining period" }, { status: 400 })
    }

    // Fetch custom schedule first
    const schedules = await prisma.mealSchedule.findMany({
      where: { studentId: student.id }
    })
    
    const schedule = schedules.find(s => {
       const dStr = s.date.toISOString().split("T")[0]
       return dStr === todayStr
    })

    // 5. Calculate if student is Auto-Off
    const periodDeposit = await getStudentPeriodDeposit(student.id, activePeriod);
    const balance = student.wallet?.balance || 0;
    const { autoOff, reason: offReason } = isStudentAutoOff(balance, activePeriod, bdtDate, periodDeposit);

    const isSuspended = autoOff && !(schedule && schedule.adminOverride);

    if (isSuspended) {
      await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_AUTO_OFF`, details: offReason }})
      await triggerGoogleSheetAppend({
        time: bdtString,
        name: student.name,
        diningId: student.diningId,
        department: student.department,
        meal: currentMeal,
        status: "AUTO-OFF",
        reason: offReason
      });
      return NextResponse.json({ error: `Meal auto-disabled: ${offReason}` }, { status: 403 })
    }

    if (schedule) {
      if (currentMeal === "LUNCH" && !schedule.lunch) {
        await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_LUNCH_${todayStr}`, details: `Lunch is turned OFF` }})
        await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal, status: "FAILED", reason: "Lunch is turned OFF for today" });
        return NextResponse.json({ error: "Lunch is turned OFF for today" }, { status: 403 })
      }
      
      if (currentMeal === "DINNER" && !schedule.dinner) {
        await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_DINNER_${todayStr}`, details: `Dinner is turned OFF` }})
        await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal, status: "FAILED", reason: "Dinner is turned OFF for today" });
        return NextResponse.json({ error: "Dinner is turned OFF for today" }, { status: 403 })
      }
    }

    // 7. Prevent double scanning using AuditLog
    const actionKey = `MEAL_SCANNED_${currentMeal}_${todayStr}`
    const existingScan = await prisma.auditLog.findFirst({
      where: {
        studentId: student.id,
        action: actionKey
      }
    })

    if (existingScan) {
      const scanTime = new Date(existingScan.createdAt).toLocaleTimeString("en-US", {
        timeZone: "Asia/Dhaka",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
      
      const detailsMsg = `Double scan attempt (previously checked in for ${currentMeal.toLowerCase()} at ${scanTime})`;
      await prisma.auditLog.create({ 
        data: { 
          studentId: student.id, 
          action: `FAILED_SCAN_${currentMeal}_${todayStr}`, 
          details: detailsMsg 
        }
      })
      await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal, status: "DOUBLE SCAN", reason: detailsMsg });
      return NextResponse.json({ error: `Student already checked in for ${currentMeal.toLowerCase()} at ${scanTime}!` }, { status: 409 })
    }

    // 8. Record the scan log
    await prisma.auditLog.create({
      data: {
        studentId: student.id,
        action: actionKey,
        details: `Checked in for ${currentMeal.toLowerCase()}`
      }
    })

    await triggerGoogleSheetAppend({
      time: bdtString,
      name: student.name,
      diningId: student.diningId,
      department: student.department,
      meal: currentMeal,
      status: "SUCCESS",
      reason: `Checked in for ${currentMeal.toLowerCase()}`
    });

    return NextResponse.json({
      success: true,
      status: "AUTHORIZED",
      reason: "",
      meal: currentMeal,
      student: {
        name: student.name,
        photo: student.user?.image,
        diningId: student.diningId,
        department: student.department
      }
    })

  } catch (error) {
    console.error("Student Check-In Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
