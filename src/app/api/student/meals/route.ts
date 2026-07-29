import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCurrentMealRates, isStudentAutoOff } from "@/lib/meal-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true }
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const month = searchParams.get("month")
    const year = searchParams.get("year")

    let startDate: Date
    let endDate: Date

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
      endDate.setUTCHours(23, 59, 59, 999)
    } else {
      const now = new Date()
      const targetMonth = month ? parseInt(month) : now.getMonth()
      const targetYear = year ? parseInt(year) : now.getFullYear()
      startDate = new Date(Date.UTC(targetYear, targetMonth, 1))
      endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999))
    }

    const schedules = await prisma.mealSchedule.findMany({
      where: {
        studentId: student.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    })

    const rates = await getCurrentMealRates()
    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    
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

    const balance = student.wallet?.balance || 0
    const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
    const { autoOff, reason } = isStudentAutoOff(balance, activePeriod, today, periodDeposit)

    return NextResponse.json({ 
      schedules, 
      rates, 
      balance,
      autoOff,
      autoOffReason: reason
    })
  } catch (error) {
    console.error("Meals error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true }
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const body = await req.json()
    const { date, lunch, dinner } = body

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    const mealDate = new Date(date)
    mealDate.setUTCHours(0, 0, 0, 0)

    const now = new Date()

    // Deadline: 10:00 PM BST the day before the target date
    const deadline = new Date(mealDate)
    deadline.setDate(deadline.getDate() - 1)
    deadline.setHours(22, 0, 0, 0)

    if (now >= deadline) {
      return NextResponse.json(
        { error: "Changes must be made before 10:00 PM BST the day before" },
        { status: 400 }
      )
    }

    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
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

    const currentBalance = student.wallet?.balance || 0;
    const { autoOff, reason } = isStudentAutoOff(currentBalance, activePeriod, mealDate, periodDeposit);
    
    // If student is automatically off, block any attempt to manually set meal to ON
    if (autoOff) {
      if (lunch || dinner) {
        return NextResponse.json(
          { error: `Cannot turn meals ON: ${reason}` },
          { status: 403 }
        )
      }
    }

    const schedule = await prisma.mealSchedule.upsert({
      where: {
        studentId_date: { studentId: student.id, date: mealDate },
      },
      update: {
        lunch: lunch ?? true,
        dinner: dinner ?? true,
      },
      create: {
        studentId: student.id,
        date: mealDate,
        lunch: lunch ?? true,
        dinner: dinner ?? true,
      },
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error("Update meals error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
