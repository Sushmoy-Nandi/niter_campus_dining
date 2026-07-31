import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff, getStudentPeriodDeposits } from "@/lib/meal-utils"
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    // Use Bangladesh time (BDT = UTC+6) for "today" to match all other APIs
    const bdtString = now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
    const bdtNow = new Date(bdtString)
    const today = new Date(Date.UTC(bdtNow.getFullYear(), bdtNow.getMonth(), bdtNow.getDate()))

    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get("periodId")

    let activePeriod = null
    if (periodId && periodId !== "null" && periodId !== "undefined" && periodId !== "") {
      activePeriod = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
    }
    
    if (!activePeriod) {
      activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    }

    let periodStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1))
    let periodEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999))
    if (activePeriod) {
      periodStart = new Date(activePeriod.startDate)
      periodEnd = new Date(activePeriod.endDate)
      periodEnd.setUTCHours(23, 59, 59, 999)
    }

    // Adjust to BDT timezone boundaries (UTC+6) for physical transaction timestamps
    const queryStart = new Date(periodStart.getTime() - 6 * 60 * 60 * 1000)
    const queryEnd = new Date(periodEnd.getTime() + 18 * 60 * 60 * 1000 - 1)

    const periodDepositMap = await getStudentPeriodDeposits(activePeriod);

    const students = await prisma.student.findMany({
      where: { isActive: true },
      include: { wallet: true }
    })
    
    const totalStudents = students.length

    const [
      monthDeposits,
      monthRefunds,
      bazaarCost,
      recentTransactions,
      recentFeedback,
      allFeedback,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "DEPOSIT", createdAt: { gte: queryStart, lte: queryEnd } },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "REFUND", createdAt: { gte: queryStart, lte: queryEnd } },
      }),
      prisma.bazaar.aggregate({
        _sum: { amount: true },
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: queryStart, lte: queryEnd } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { student: { select: { name: true, studentId: true } } },
      }),
      prisma.mealFeedback.findMany({
        orderBy: { date: "desc" },
        take: 10,
        include: { student: { select: { name: true, diningId: true } } },
      }),
      prisma.mealFeedback.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
        select: { rating: true }
      })
    ])

    const todaySchedules = await prisma.mealSchedule.findMany({
      where: { date: today }
    })
    
    const scheduleMapByDate = new Map()
    scheduleMapByDate.set(today.toISOString().split("T")[0], todaySchedules)

    // Function to calculate meals for a specific date
    const calculateMealsForDate = async (targetDate: Date) => {
      const dateStr = targetDate.toISOString().split("T")[0]
      let schedulesForDate = scheduleMapByDate.get(dateStr)
      if (!schedulesForDate) {
        schedulesForDate = await prisma.mealSchedule.findMany({
          where: { date: targetDate }
        })
        scheduleMapByDate.set(dateStr, schedulesForDate)
      }

      let lunchCount = 0
      let dinnerCount = 0
      
      for (const student of students) {
        const balance = student.wallet?.balance || 0
        const periodDeposit = periodDepositMap.get(student.id) || 0
        const { autoOff } = isStudentAutoOff(balance, activePeriod, targetDate, periodDeposit)
        
        if (autoOff) continue // Skip this student entirely for this date

        // If not auto-off, check schedule
        const schedule = schedulesForDate.find((s: any) => s.studentId === student.id)
        if (schedule) {
          if (schedule.lunch) lunchCount++
          if (schedule.dinner) dinnerCount++
        } else {
          // Default ON
          lunchCount++
          dinnerCount++
        }
      }
      return { lunchCount, dinnerCount }
    }

    const todayMealsResult = await calculateMealsForDate(today)
    let todayLunch = todayMealsResult.lunchCount
    let todayDinner = todayMealsResult.dinnerCount

    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const meals = await calculateMealsForDate(d)
      last7Days.push({
        date: d.toISOString().split("T")[0],
        meals: meals.lunchCount + meals.dinnerCount,
      })
    }

    const totalDeposits = monthDeposits._sum.amount || 0
    const totalRefunds = monthRefunds._sum.amount || 0
    const totalBazaarCost = bazaarCost._sum.amount || 0

    // Sum of all deposits minus refunds and bazaar expenses for the active period
    const outstandingBalance = totalDeposits - totalRefunds - totalBazaarCost

    const feedbackStats = {
      total: allFeedback.length,
      average: allFeedback.length > 0 ? (allFeedback.reduce((acc, f) => acc + f.rating, 0) / allFeedback.length).toFixed(1) : 0,
      distribution: {
        5: allFeedback.filter(f => f.rating === 5).length,
        4: allFeedback.filter(f => f.rating === 4).length,
        3: allFeedback.filter(f => f.rating === 3).length,
        2: allFeedback.filter(f => f.rating === 2).length,
        1: allFeedback.filter(f => f.rating === 1).length,
      }
    }

    return NextResponse.json({
      stats: {
        totalStudents,
        totalRefunds,
        totalDeposits,
        totalMealCost: totalBazaarCost,
        outstandingBalance,
        todayMeals: { lunch: todayLunch, dinner: todayDinner },
      },
      charts: {
        dailyMeals: last7Days,
        monthlyBreakdown: [
          { type: "Deposits", amount: totalDeposits },
          { type: "Bazaar Expenses", amount: totalBazaarCost },
          { type: "Refunds", amount: totalRefunds },
        ],
      },
      recentTransactions,
      recentFeedback,
      feedbackStats,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error("Admin dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
