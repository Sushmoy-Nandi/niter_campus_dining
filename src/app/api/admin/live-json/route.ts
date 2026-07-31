import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff, calculateDynamicMealRate, periodEndInclusive } from "@/lib/meal-utils"
import { getMasterSheetSecret } from "@/lib/secrets"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("secret")
    
    const expectedSecret = getMasterSheetSecret()
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

    // Shift start and end dates by 6 hours to capture the physical transactions in BDT (UTC+6)
    const start = new Date(new Date(activePeriod.startDate).getTime() - 6 * 60 * 60 * 1000)
    const end = new Date(new Date(activePeriod.endDate).getTime() + 18 * 60 * 60 * 1000 - 1)

    // Fetch both DEPOSITS and REFUNDS in the BDT period
    const rawTransactions = await prisma.transaction.findMany({
      where: {
        type: { in: ["DEPOSIT", "REFUND"] },
        createdAt: { gte: start, lte: end }
      },
      orderBy: { createdAt: "asc" }
    });

    // Map deposits and refunds separately to avoid negative deposit entries in Google Sheets
    const studentDepositsMap = new Map<string, number[]>();
    const studentRefundsMap = new Map<string, number>();

    for (const t of rawTransactions) {
      if (t.type === "DEPOSIT") {
        if (!studentDepositsMap.has(t.studentId)) {
          studentDepositsMap.set(t.studentId, []);
        }
        studentDepositsMap.get(t.studentId)!.push(t.amount);
      } else if (t.type === "REFUND") {
        const existingRefund = studentRefundsMap.get(t.studentId) || 0;
        studentRefundsMap.set(t.studentId, existingRefund + t.amount);
      }
    }
    
    // Timezone-safe UTC date calculation for the days list to avoid calendar offset shifts
    const periodStart = new Date(activePeriod.startDate)
    const periodEnd = new Date(activePeriod.endDate)
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
    const dIter = new Date(periodStart)
    while (dIter <= periodEnd) {
      daysList.push(dIter.toISOString())
      dIter.setUTCDate(dIter.getUTCDate() + 1)
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
        
        const depTxs = studentDepositsMap.get(student.id) || [];
        const refundAmt = studentRefundsMap.get(student.id) || 0;
        const sumDeps = depTxs.reduce((a, b) => a + b, 0);
        
        const meals: { l: number, d: number }[] = [];
        let totalMealsCount = 0;
        
        daysList.forEach(dayIso => {
          const d = new Date(dayIso);
          const dStr = dayIso.split('T')[0];
          const s = scheduleMap.get(dStr)?.get(student.id);

          const { autoOff } = isStudentAutoOff(balance, activePeriod, d, sumDeps);
          const isSuspended = autoOff && !(s && s.adminOverride);

          if (isSuspended) {
            meals.push({ l: 0, d: 0 });
          } else {
            const l = s ? (s.lunch ? 1 : 0) : 1;
            const din = s ? (s.dinner ? 1 : 0) : 1;
            meals.push({ l, d: din });
            totalMealsCount += (l + din);
          }
        });

        // Wallet balance represents the TOTAL money they have
        const carryOver = balance - sumDeps + refundAmt;
        let depositsArray = carryOver > 0 ? [carryOver, ...depTxs] : [...depTxs];

        // Ensure the array doesn't exceed 3 slots for the Google Sheet
        if (depositsArray.length > 3) {
          const combinedThird = depositsArray.slice(2).reduce((sum, val) => sum + val, 0);
          depositsArray = [depositsArray[0], depositsArray[1], combinedThird];
        }

        return {
          name: student.name,
          diningId: student.diningId,
          department: student.department || '',
          deposit: balance,
          deposits: depositsArray,
          refund: refundAmt,
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