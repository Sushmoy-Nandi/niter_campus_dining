import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateDynamicMealRate } from "@/lib/meal-utils"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })
    
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Fetch past dining periods
    const periods = await prisma.diningPeriod.findMany({
      where: { isActive: false },
      orderBy: { endDate: "desc" }
    })

    const invoices = []

    for (const period of periods) {
      // Get all meals for this period
      const schedules = await prisma.mealSchedule.findMany({
        where: {
          studentId: student.id,
          date: { gte: period.startDate, lte: period.endDate }
        }
      })

      let lunchCount = 0
      let dinnerCount = 0

      for (const s of schedules) {
        if (s.lunch) lunchCount++
        if (s.dinner) dinnerCount++
      }

      const totalMeals = lunchCount + dinnerCount

      // Get meal rate for period
      const rateData = await calculateDynamicMealRate(period.startDate, period.endDate)
      const mealRate = rateData.mealRate

      // Get deposits made during this period
      const deposits = await prisma.transaction.findMany({
        where: {
          studentId: student.id,
          type: "DEPOSIT",
          createdAt: { gte: period.startDate, lte: period.endDate }
        }
      })

      const totalDeposit = deposits.reduce((acc, curr) => acc + curr.amount, 0)
      const totalCost = totalMeals * mealRate

      invoices.push({
        periodId: period.id,
        periodTitle: period.title,
        startDate: period.startDate,
        endDate: period.endDate,
        lunchCount,
        dinnerCount,
        totalMeals,
        mealRate,
        totalCost,
        totalDeposit
      })
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}
