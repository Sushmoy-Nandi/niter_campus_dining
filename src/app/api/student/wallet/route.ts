import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateDynamicMealRate } from "@/lib/meal-utils"

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

    const now = new Date()
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    let periodStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1))
    let periodEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999))

    if (activePeriod) {
      periodStart = new Date(activePeriod.startDate)
      periodEnd = new Date(activePeriod.endDate)
      periodEnd.setUTCHours(23, 59, 59, 999)
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

    const msInDay = 24 * 60 * 60 * 1000
    const daysInMonth = Math.round((periodEnd.getTime() - periodStart.getTime()) / msInDay)
    let monthlyMealCount = daysInMonth * 2 // Default: 2 meals per day

    const monthlySchedules = await prisma.mealSchedule.findMany({
      where: {
        studentId: student.id,
        date: { gte: periodStart, lte: periodEnd },
      },
    })

    for (const schedule of monthlySchedules) {
      if (!schedule.lunch) monthlyMealCount -= 1
      if (!schedule.dinner) monthlyMealCount -= 1
    }

    const { mealRate } = await calculateDynamicMealRate(periodStart, periodEnd)
    const balance = student.wallet?.balance || 0
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
