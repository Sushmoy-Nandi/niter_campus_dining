import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff } from "@/lib/meal-utils"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { studentId, type } = body

    if (type !== "MEAL_CHECKIN" || !studentId) {
      return NextResponse.json({ error: "Invalid QR code format" }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { wallet: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (!student.isActive) {
      return NextResponse.json({ error: "Student account is inactive" }, { status: 403 })
    }

    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })
    let periodDeposit = 0;
    if (activePeriod) {
      const deposits = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { 
          studentId: student.id, 
          type: "DEPOSIT",
          createdAt: { gte: activePeriod.startDate, lte: activePeriod.endDate }
        }
      });
      periodDeposit = deposits._sum.amount || 0;
    }

    const balance = student.wallet?.balance || 0;
    const { autoOff, reason: offReason } = isStudentAutoOff(balance, activePeriod, new Date(), periodDeposit);

    if (autoOff) {
      await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_AUTO_OFF`, details: offReason }})
      return NextResponse.json({ error: `Meal auto-disabled: ${offReason}` }, { status: 403 })
    }

    // Get current time in Bangladesh Time (BDT)
    const bdtString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const bdtDate = new Date(bdtString);
    const hour = bdtDate.getHours();
    
    const year = bdtDate.getFullYear();
    const month = String(bdtDate.getMonth() + 1).padStart(2, '0');
    const day = String(bdtDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Determine meal type based on time
    // Lunch: 10:00 to 16:59
    // Dinner: 17:00 to 23:59 (and up to 3:59 AM)
    let currentMeal: "lunch" | "dinner" | null = null;
    if (hour >= 10 && hour < 17) currentMeal = "lunch";
    if (hour >= 17 || hour < 4) currentMeal = "dinner"; // allow until late

    if (!currentMeal) {
      return NextResponse.json({ error: "No active meal service at this time" }, { status: 400 })
    }

    // Find the schedule for today
    const schedules = await prisma.mealSchedule.findMany({
      where: { studentId: student.id }
    })
    
    const schedule = schedules.find(s => {
       const dStr = s.date.toISOString().split("T")[0]
       return dStr === todayStr
    })

    // If no schedule exists, meals are ON by default.
    // If it exists, we check if the specific meal is turned OFF.
    if (schedule) {
      if (currentMeal === "lunch" && !schedule.lunch) {
        await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_LUNCH_${todayStr}`, details: `Lunch is turned OFF` }})
        return NextResponse.json({ error: "Lunch is turned OFF for today" }, { status: 403 })
      }
      
      if (currentMeal === "dinner" && !schedule.dinner) {
        await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_DINNER_${todayStr}`, details: `Dinner is turned OFF` }})
        return NextResponse.json({ error: "Dinner is turned OFF for today" }, { status: 403 })
      }
    }

    // Prevent double scanning using AuditLog
    const actionKey = `MEAL_SCANNED_${currentMeal.toUpperCase()}_${todayStr}`
    const existingScan = await prisma.auditLog.findFirst({
      where: {
        studentId: student.id,
        action: actionKey
      }
    })

    if (existingScan) {
      await prisma.auditLog.create({ data: { studentId: student.id, action: `FAILED_SCAN_${currentMeal.toUpperCase()}_${todayStr}`, details: `Double scan attempt` }})
      return NextResponse.json({ error: `Student already scanned in for ${currentMeal} today!` }, { status: 409 })
    }

    // Record the scan
    await prisma.auditLog.create({
      data: {
        studentId: student.id,
        action: actionKey,
        details: `Checked in for ${currentMeal}`
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: "Check-in Successful!",
      student: { name: student.name, diningId: student.diningId, currentMeal } 
    }, { status: 200 })

  } catch (error) {
    console.error("Scan error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
