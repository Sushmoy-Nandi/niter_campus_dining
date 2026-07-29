import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff, getStudentPeriodDeposits } from "@/lib/meal-utils"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    
    if (!session || (role !== "ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get("date")
    const startDateParam = searchParams.get("startDate") || dateParam
    const endDateParam = searchParams.get("endDate") || dateParam

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: "Date parameters are required" }, { status: 400 })
    }

    const startDate = new Date(startDateParam)
    const endDate = new Date(endDateParam)
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    // Set to local day boundaries for accurate querying
    const startOfDay = new Date(startDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Fetch active dining period for auto-off rules
    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })

    const students = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { diningId: 'asc' },
      include: { wallet: true },
    })

    const schedules = await prisma.mealSchedule.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      }
    })

    const feedbacks = await prisma.mealFeedback.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      },
      select: { rating: true }
    })
    // Fetch all audit logs for this date range for scans
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    })
    
    const scanStats = {
      scannedLunch: logs.filter(l => l.action.startsWith("MEAL_SCANNED_LUNCH")).length,
      scannedDinner: logs.filter(l => l.action.startsWith("MEAL_SCANNED_DINNER")).length,
      failedLunch: logs.filter(l => l.action.startsWith("FAILED_SCAN_LUNCH")).length,
      failedDinner: logs.filter(l => l.action.startsWith("FAILED_SCAN_DINNER")).length,
    }

    // Group schedules by student ID
    const scheduleMap = new Map()
    schedules.forEach(s => {
      if (!scheduleMap.has(s.studentId)) {
        scheduleMap.set(s.studentId, [])
      }
      scheduleMap.get(s.studentId).push(s)
    })

    // Calculate number of days in the range (inclusive)
    const diffTime = Math.abs(endOfDay.getTime() - startOfDay.getTime()) + 1; // +1 to make it exactly divisible
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let totalLunch = 0;
    const periodDepositMap = await getStudentPeriodDeposits(activePeriod);

    let totalDinner = 0;
    let totalGuestLunch = 0;
    let totalGuestDinner = 0;

    const result = students.map(student => {
      const studentSchedules = scheduleMap.get(student.id) || []
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      
      let lunch = 0;
      let dinner = 0;
      let guestLunch = 0;
      let guestDinner = 0;
      
      // Calculate guest meals
      studentSchedules.forEach((s: any) => {
        guestLunch += s.guestLunch || 0;
        guestDinner += s.guestDinner || 0;
      });

      const balance = student.wallet?.balance || 0;
      let autoOff = false; // Just to reflect current status for the UI
      
      const iterDate = new Date(startOfDay);
      while (iterDate <= endOfDay) {
        const { autoOff: dayAutoOff } = isStudentAutoOff(balance, activePeriod, iterDate, periodDeposit);
        if (iterDate.getTime() === endOfDay.getTime()) {
           autoOff = dayAutoOff; // Status as of the end of the range
        }
        
        if (!dayAutoOff) {
          const year = iterDate.getFullYear();
          const month = iterDate.getMonth();
          const day = iterDate.getDate();
          
          const s = studentSchedules.find((sched: any) => {
             const d = new Date(sched.date);
             return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
          });
          
          if (s) {
            if (s.lunch) lunch++;
            if (s.dinner) dinner++;
          } else {
            lunch++;
            dinner++;
          }
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }

      totalLunch += lunch;
      totalDinner += dinner;
      totalGuestLunch += guestLunch;
      totalGuestDinner += guestDinner;

      return {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        diningId: student.diningId || "",
        lunch,
        dinner,
        guestLunch,
        guestDinner,
        autoOff,
      }
    })

    const feedbackStats = {
      total: feedbacks.length,
      average: feedbacks.length > 0 ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1) : 0,
      distribution: {
        5: feedbacks.filter(f => f.rating === 5).length,
        4: feedbacks.filter(f => f.rating === 4).length,
        3: feedbacks.filter(f => f.rating === 3).length,
        2: feedbacks.filter(f => f.rating === 2).length,
        1: feedbacks.filter(f => f.rating === 1).length,
      }
    }

    return NextResponse.json({ 
      date: dateParam, 
      students: result,
      summary: {
        totalLunch,
        totalDinner,
        totalGuestLunch,
        totalGuestDinner
      },
      scanStats,
      feedbackStats
    })
  } catch (error) {
    console.error("Failed to fetch daily meals:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
