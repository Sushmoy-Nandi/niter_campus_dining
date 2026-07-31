import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateDynamicMealRate, isStudentAutoOff, getStudentPeriodDeposit, toUTCDateKey, getBDTTodayStartUTC } from "@/lib/meal-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // "Today" anchored to Bangladesh calendar day, as a UTC-midnight Date — the same
    // convention every other route uses, so the fallback month is correct on any server tz.
    const today = getBDTTodayStartUTC()
    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    let periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    let periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    let periodDeposit = 0

    if (activePeriod) {
      periodStart = new Date(activePeriod.startDate)
      periodEnd = new Date(activePeriod.endDate)
      periodEnd.setUTCHours(23, 59, 59, 999)

      periodDeposit = await getStudentPeriodDeposit(student.id, activePeriod)
    }

    const recentDeposits = await prisma.transaction.findMany({
      where: { 
        studentId: student.id, 
        type: "DEPOSIT",
        createdAt: { gte: periodStart, lte: periodEnd }
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    const balance = student.wallet?.balance || 0

    const monthlySchedules = await prisma.mealSchedule.findMany({
      where: {
        studentId: student.id,
        date: { gte: periodStart, lte: periodEnd },
      },
    })

    // Key by UTC calendar day (storage is UTC-midnight), matching the student dashboard exactly.
    const scheduleMap = new Map()
    monthlySchedules.forEach(s => {
      scheduleMap.set(toUTCDateKey(s.date), s)
    })

    // Count meals day-by-day, skipping any day the student is auto-suspended.
    // This mirrors the dashboard so the wallet's remaining balance can never
    // diverge from the spending shown there.
    let monthlyMealCount = 0
    const iterDate = new Date(periodStart)
    while (iterDate <= periodEnd) {
      const { autoOff: dayAutoOff } = isStudentAutoOff(balance, activePeriod, iterDate, periodDeposit)
      if (!dayAutoOff) {
        const s = scheduleMap.get(toUTCDateKey(iterDate))
        if (s) {
          if (s.lunch) monthlyMealCount++
          if (s.dinner) monthlyMealCount++
        } else {
          monthlyMealCount += 2 // Default 2 meals
        }
      }
      iterDate.setUTCDate(iterDate.getUTCDate() + 1)
    }

    const { mealRate } = await calculateDynamicMealRate(periodStart, periodEnd)
    const remainingBalance = balance - (monthlyMealCount * mealRate)

    return NextResponse.json({
      wallet: student.wallet,
      recentDeposits,
      remainingBalance,
    })
  } catch (error) {
    console.error("Wallet error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
