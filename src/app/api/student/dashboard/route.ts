import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCurrentMealRates, calculateDynamicMealRate, isStudentAutoOff, getStudentPeriodDeposits } from "@/lib/meal-utils"

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
    
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const todaySchedule = await prisma.mealSchedule.findUnique({
      where: {
        studentId_date: { studentId: student.id, date: today },
      },
    })

    const tomorrowSchedule = await prisma.mealSchedule.findUnique({
      where: {
        studentId_date: { studentId: student.id, date: tomorrow },
      },
    })

    // Find active dining period
    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    let periodStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1))
    let periodEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999))
    let periodId = ""
    let periodDeposit = 0;

    if (activePeriod) {
      periodStart = new Date(activePeriod.startDate)
      periodEnd = new Date(activePeriod.endDate)
      periodEnd.setUTCHours(23, 59, 59, 999)
      periodId = activePeriod.id

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

    const todayDate = new Date()
    todayDate.setUTCHours(0, 0, 0, 0)
    
    const balance = student.wallet?.balance || 0
    const { autoOff, reason: autoOffReason } = isStudentAutoOff(balance, activePeriod, todayDate, periodDeposit);

    const monthlySchedules = await prisma.mealSchedule.findMany({
      where: {
        studentId: student.id,
        date: { gte: periodStart, lte: periodEnd },
      },
    })

    const scheduleMap = new Map();
    monthlySchedules.forEach(s => {
      const d = new Date(s.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      scheduleMap.set(dateStr, s);
    });

    let monthlyMealCount = 0;
    const iterDate = new Date(periodStart);
    while (iterDate <= periodEnd) {
      const { autoOff: dayAutoOff } = isStudentAutoOff(balance, activePeriod, iterDate, periodDeposit);
      if (!dayAutoOff) {
        const year = iterDate.getFullYear();
        const month = iterDate.getMonth();
        const day = iterDate.getDate();
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const s = scheduleMap.get(dateStr);
        if (s) {
          if (s.lunch) monthlyMealCount++;
          if (s.dinner) monthlyMealCount++;
        } else {
          monthlyMealCount += 2; // Default 2 meals
        }
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }

    // Dynamic "Mess-style" spending: this student's total meals × current bazaar rate
    const { mealRate } = await calculateDynamicMealRate(periodStart, periodEnd)
    const monthlySpending = monthlyMealCount * mealRate

    const recentTransactions = await prisma.transaction.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    const rates = await getCurrentMealRates()

    return NextResponse.json({
      student: {
        id: student.id,
        studentId: student.studentId,
        diningId: student.diningId,
        name: student.name,
        email: student.email,
        department: student.department,
        session: student.session,
      },
      wallet: student.wallet,
      todayMeals: todaySchedule,
      tomorrowMeals: tomorrowSchedule,
      monthlyMealCount,
      monthlySpending,
      recentTransactions,
      mealRates: rates,
      periodId,
      periodTitle: activePeriod?.title || "",
      autoOff,
      autoOffReason
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
