import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff, getStudentPeriodDeposits, toUTCDateKey } from "@/lib/meal-utils"

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

    // UTC day boundaries. Logical dates (schedules/periods) are stored at UTC
    // midnight, so we must bound the range in UTC — setHours() would read the
    // server's local day and drift the whole range by a day on non-UTC servers.
    const startOfDay = new Date(startDate)
    startOfDay.setUTCHours(0, 0, 0, 0)

    const endOfDay = new Date(endDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

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

    const result = students.map(student => {
      const studentSchedules = scheduleMap.get(student.id) || []
      const periodDeposit = periodDepositMap.get(student.id) || 0;

      // Index this student's schedules by UTC day key for O(1), timezone-agnostic lookup.
      const dayScheduleMap = new Map<string, any>();
      studentSchedules.forEach((sched: any) => dayScheduleMap.set(toUTCDateKey(sched.date), sched));

      let lunch = 0;
      let dinner = 0;

      const balance = student.wallet?.balance || 0;
      let autoOff = false; // Just to reflect current status for the UI

       const iterDate = new Date(startOfDay);
      while (iterDate <= endOfDay) {
        const { autoOff: dayAutoOff } = isStudentAutoOff(balance, activePeriod, iterDate, periodDeposit);
        const s = dayScheduleMap.get(toUTCDateKey(iterDate));
        const isSuspended = dayAutoOff && !(s && s.adminOverride);
        
        autoOff = isSuspended;

        if (!isSuspended) {
          if (s) {
            if (s.lunch) lunch++;
            if (s.dinner) dinner++;
          } else {
            lunch++;
            dinner++;
          }
        }
        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
      }

      totalLunch += lunch;
      totalDinner += dinner;

      return {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        diningId: student.diningId || "",
        lunch,
        dinner,
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
        totalDinner
      },
      scanStats,
      feedbackStats
    })
  } catch (error) {
    console.error("Failed to fetch daily meals:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
