import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff, getStudentPeriodDeposits } from "@/lib/meal-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get("periodId")
    const monthParam = searchParams.get("month") || String(new Date().getMonth())
    const yearParam = searchParams.get("year") || String(new Date().getFullYear())
    
    let startDate: Date
    let endDate: Date
    let reportTitle = ""
    let activePeriod = null;

    if (periodId) {
      const period = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
      if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 })
      startDate = new Date(period.startDate)
      endDate = new Date(period.endDate)
      endDate.setUTCHours(23, 59, 59, 999)
      reportTitle = period.title
      activePeriod = period
    } else {
      const month = parseInt(monthParam)
      const year = parseInt(yearParam)
      startDate = new Date(Date.UTC(year, month, 1))
      endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))
      reportTitle = `${year}-${String(month + 1).padStart(2, '0')}`
      activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true }})
    }

    // 1. Calculate overall Meal Rate
    const bazaars = await prisma.bazaar.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    })
    const totalBazaarCost = bazaars.reduce((sum, b) => sum + b.amount, 0)

    const schedules = await prisma.mealSchedule.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    })

    const students = await prisma.student.findMany({
      where: { isActive: true },
      include: {
        wallet: true,
        transactions: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
            type: "DEPOSIT"
          }
        }
      }
    })

    const scheduleMap = new Map()
    schedules.forEach(s => {
      const d = new Date(s.date)
      const dateStr = d.toLocaleDateString("en-CA")
      scheduleMap.set(`${s.studentId}-${dateStr}`, s)
    })

    const periodDepositMap = await getStudentPeriodDeposits(activePeriod);

    let systemTotalMeals = 0
    
    // First pass: Calculate total meals for rate
    const studentStats = students.map(student => {
      let meals = 0
      const balance = student.wallet?.balance || 0;
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      
      const d = new Date(startDate)
      while (d <= endDate) {
        const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);
        const year = d.getFullYear()
        const month = d.getMonth()
        const day = d.getDate()
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        
        const s = scheduleMap.get(`${student.id}-${dateStr}`)
        
        if (!autoOff) {
          if (s) {
            if (s.lunch) meals += 1
            if (s.dinner) meals += 1
          } else {
            meals += 2
          }
        }
        
        // Removed guest meals calculation
        
        d.setDate(d.getDate() + 1)
      }
      
      systemTotalMeals += meals

      const monthDeposit = student.transactions.reduce((sum, t) => sum + t.amount, 0)

      return {
        studentId: student.studentId,
        name: student.name,
        department: student.department,
        info: student.session,
        totalMeals: meals,
        monthDeposit,
        currentWalletBalance: student.wallet?.balance || 0,
        cost: 0,
        onHand: 0
      }
    })

    const mealRate = systemTotalMeals > 0 ? (totalBazaarCost / systemTotalMeals) : 0

    // Second pass: Calculate costs
    studentStats.forEach(s => {
      s.cost = Number((s.totalMeals * mealRate).toFixed(2))
      s.onHand = Number((s.monthDeposit - s.cost).toFixed(2))
    })

    return NextResponse.json({
      summary: {
        totalBazaarCost,
        totalMeals: systemTotalMeals,
        mealRate: Number(mealRate.toFixed(2))
      },
      report: studentStats,
      reportTitle
    })

  } catch (error) {
    console.error("Reports error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
