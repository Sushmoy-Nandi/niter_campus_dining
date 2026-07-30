import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff, calculateDynamicMealRate } from "@/lib/meal-utils"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("secret")
    
    const expectedSecret = process.env.MASTER_SHEET_SECRET || process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET || "NITER_MASTER_2026"
    if (!secret || secret !== expectedSecret) {
      return new NextResponse("Unauthorized. Invalid secret key.", { status: 401 })
    }

    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })
    
    if (!activePeriod) {
      return new NextResponse("No active period found", { status: 400 })
    }

    const students = await prisma.student.findMany({
      where: { isActive: true },
      include: { wallet: true },
      orderBy: { diningId: 'asc' }
    })

    const rawDeposits = await prisma.transaction.findMany({
      where: {
        type: "DEPOSIT",
        createdAt: { gte: activePeriod.startDate, lte: activePeriod.endDate }
      },
      orderBy: { createdAt: "asc" }
    });

    const studentDepositsMap = new Map<string, number[]>();
    for (const d of rawDeposits) {
      if (!studentDepositsMap.has(d.studentId)) {
        studentDepositsMap.set(d.studentId, []);
      }
      studentDepositsMap.get(d.studentId)!.push(d.amount);
    }
    const periodStart = new Date(activePeriod.startDate)
    const periodEnd = new Date(activePeriod.endDate)
    periodEnd.setHours(23, 59, 59, 999) // Force end of day
    periodEnd.setUTCHours(23, 59, 59, 999)

    const allSchedules = await prisma.mealSchedule.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } },
    })

    const scheduleMap = new Map<string, Map<string, any>>();
    allSchedules.forEach(s => {
      const dStr = new Date(s.date).toISOString().split('T')[0];
      if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
      scheduleMap.get(dStr)!.set(s.studentId, s);
    });

    const daysList: string[] = []
    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
      daysList.push(d.toISOString());
    }

    const bazaars = await prisma.bazaar.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } }
    })

    const calculateDynamicMealRateResult = await calculateDynamicMealRate(activePeriod.startDate, activePeriod.endDate);

    // Construct the payload for the Apps Script
    const payload = {
      period: {
        title: activePeriod.title,
        startDate: activePeriod.startDate,
        endDate: activePeriod.endDate
      },
      days: daysList,
      bazaars: bazaars.map(b => ({
        date: b.date,
        name: b.name,
        details: b.details,
        amount: b.amount
      })),
      students: students.map(student => {
        const balance = student.wallet?.balance || 0;
        const depositTxs = studentDepositsMap.get(student.id) || [];
        const sumTxs = depositTxs.reduce((a, b) => a + b, 0);
        const meals: { l: number, d: number }[] = [];
        let totalMealsCount = 0;
        
        daysList.forEach(dayIso => {
          const d = new Date(dayIso);
          const { autoOff } = isStudentAutoOff(balance, activePeriod, d, sumTxs);
          if (autoOff) {
            meals.push({ l: 0, d: 0 });
          } else {
            const dStr = dayIso.split('T')[0];
            const s = scheduleMap.get(dStr)?.get(student.id);
            const l = s ? (s.lunch ? 1 : 0) : 1;
            const din = s ? (s.dinner ? 1 : 0) : 1;
            meals.push({ l, d: din });
            totalMealsCount += (l + din);
          }
        });

        // Wallet balance represents the TOTAL money they have (carry-over + new deposits)
        // because meal costs are only permanently deducted at the end of the month.
        const carryOver = balance - sumTxs;
        const depositsArray = [carryOver > 0 ? carryOver : 0, ...depositTxs];

        return {
          name: student.name,
          diningId: student.diningId,
          department: student.department || '',
          deposit: balance,
          deposits: depositsArray,
          meals: meals
        }
      })
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error("Export JSON Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
