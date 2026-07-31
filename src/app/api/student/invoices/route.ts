import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateDynamicMealRate, toUTCDateKey, periodEndInclusive } from "@/lib/meal-utils"

// Parses the meal count and rate out of a settlement's MEAL_DEDUCTION description.
// The settlement writes exactly: `Settlement for ${title} (${meals} meals @ ${rate})`.
// The trailing "( … meals @ … )" segment is fixed, so a greedy title capture is
// unambiguous even when the title itself ends in "(2)".
const SETTLEMENT_RE = /^Settlement for (.+) \((\d+)\s*meals?\s*@\s*([\d.]+)\)$/

export async function GET(req: Request) {
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

    // Fetch past dining periods
    const periods = await prisma.diningPeriod.findMany({
      where: { isActive: false },
      orderBy: { endDate: "desc" }
    })

    // The PERMANENT record of what was actually charged: every settlement writes one
    // MEAL_DEDUCTION per student embedding the exact meals + rate it deducted. We key
    // these by the period title (exact match) so each invoice reflects the immutable
    // amount taken from the wallet — never a fresh recompute that could drift from it.
    const deductions = await prisma.transaction.findMany({
      where: { studentId: student.id, type: "MEAL_DEDUCTION" },
    })
    const settledByTitle = new Map<string, { cost: number; meals: number; rate: number }>()
    for (const t of deductions) {
      const m = t.description?.match(SETTLEMENT_RE)
      if (m) {
        settledByTitle.set(m[1], { cost: t.amount, meals: parseInt(m[2], 10), rate: parseFloat(m[3]) })
      }
    }

    const invoices = []

    for (const period of periods) {
      // End-of-day inclusive so a deposit made on the final calendar day of the period
      // is never silently excluded (period.endDate alone is UTC-midnight = 00:00:00).
      const periodEnd = periodEndInclusive(period.endDate)

      // Deposits attributed to this period. The rollover-in from the previous settlement
      // is timestamped at this period's start, so it is (correctly) counted here as the
      // carried-forward opening balance; the rollover-OUT lands in the next period.
      const depositAgg = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          studentId: student.id,
          type: "DEPOSIT",
          createdAt: { gte: period.startDate, lte: periodEnd }
        }
      })
      const totalDeposit = depositAgg._sum.amount || 0

      const settled = settledByTitle.get(period.title)

      let totalMeals: number
      let mealRate: number
      let totalCost: number

      if (settled) {
        // Authoritative: mirror exactly what the settlement permanently deducted.
        totalMeals = settled.meals
        mealRate = Number(settled.rate.toFixed(2))
        totalCost = Number(settled.cost.toFixed(2))
      } else {
        // No permanent deduction exists for this student/period — either the period was
        // settled with a zero cost, or predates settlement. Fall back to a live, period-
        // scoped estimate (default 2 meals/day, inclusive UTC range) purely for display.
        const { mealRate: liveRate } = await calculateDynamicMealRate(period.startDate, period.endDate)
        const schedules = await prisma.mealSchedule.findMany({
          where: { studentId: student.id, date: { gte: period.startDate, lte: periodEnd } }
        })
        const scheduleMap = new Map<string, any>()
        schedules.forEach(s => scheduleMap.set(toUTCDateKey(s.date), s))

        let meals = 0
        const iter = new Date(period.startDate)
        while (iter <= periodEnd) {
          const s = scheduleMap.get(toUTCDateKey(iter))
          if (s) {
            if (s.lunch) meals++
            if (s.dinner) meals++
          } else {
            meals += 2
          }
          iter.setUTCDate(iter.getUTCDate() + 1)
        }
        totalMeals = meals
        mealRate = liveRate
        totalCost = Number((meals * liveRate).toFixed(2))
      }

      invoices.push({
        periodId: period.id,
        periodTitle: period.title,
        startDate: period.startDate,
        endDate: period.endDate,
        totalMeals,
        mealRate,
        totalCost,
        totalDeposit
      })
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error("Invoices error:", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}
