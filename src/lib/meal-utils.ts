import { prisma } from "./prisma"
import { sendEmail } from "./email"

export async function getCurrentMealRates() {
  const rate = await prisma.mealRate.findFirst({
    orderBy: { effectiveFrom: "desc" },
  })
  if (!rate) {
    return { lunchPrice: 60, dinnerPrice: 50 }
  }
  return {
    lunchPrice: rate.lunchPrice,
    dinnerPrice: rate.dinnerPrice,
  }
}

export async function calculateDailyCharge(
  studentId: string,
  date: Date,
  lunch: boolean,
  dinner: boolean
) {
  const rates = await getCurrentMealRates()
  const lunchCharge = lunch ? rates.lunchPrice : 0
  const dinnerCharge = dinner ? rates.dinnerPrice : 0
  const totalCharge = lunchCharge + dinnerCharge

  return { lunchCharge, dinnerCharge, totalCharge }
}

export function getTodayInBDT(): Date {
  const now = new Date()
  const bdtOffset = 6 * 60
  const localOffset = now.getTimezoneOffset()
  const bdtTime = new Date(now.getTime() + (bdtOffset + localOffset) * 60000)
  bdtTime.setUTCHours(0, 0, 0, 0)
  return bdtTime
}

export function getDateString(date: Date): string {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().split("T")[0]
}

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} BDT`
}

export async function getStudentPeriodDeposits(activePeriod: any) {
  if (!activePeriod) return new Map<string, number>();
  const deposits = await prisma.transaction.groupBy({
    by: ['studentId'],
    _sum: { amount: true },
    where: {
      type: "DEPOSIT",
      createdAt: { gte: activePeriod.startDate, lte: activePeriod.endDate }
    }
  });
  const map = new Map<string, number>();
  for (const d of deposits) {
    map.set(d.studentId, d._sum.amount || 0);
  }
  return map;
}

export function isStudentAutoOff(
  balance: number,
  activePeriod: any | null,
  targetDate: Date,
  periodDeposit: number = 0
): { autoOff: boolean; reason: string } {
  if (activePeriod) {
    if (balance < activePeriod.minimumBalance) {
      return { autoOff: true, reason: `Wallet balance is below minimum (${activePeriod.minimumBalance} BDT)` }
    }
    if (activePeriod.depositDeadline) {
      const targetStr = targetDate.toISOString().split("T")[0]
      const deadlineStr = new Date(activePeriod.depositDeadline).toISOString().split("T")[0]
      if (targetStr > deadlineStr) {
        if (periodDeposit < activePeriod.minimumDeposit) {
          return { autoOff: true, reason: `Required deposit (${activePeriod.minimumDeposit} BDT) not met by deadline` }
        }
      }
    }
    return { autoOff: false, reason: "" }
  } else {
    if (balance <= 0) return { autoOff: true, reason: "Wallet balance is 0 or negative" }
    return { autoOff: false, reason: "" }
  }
}

/**
 * Dynamic "Mess-style" meal rate for a date range.
 */
export async function calculateDynamicMealRate(startDate: Date, endDate: Date) {
  const bazaars = await prisma.bazaar.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  })
  const totalBazaarCost = bazaars.reduce((sum, b) => sum + b.amount, 0)

  const allSchedules = await prisma.mealSchedule.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  })

  const students = await prisma.student.findMany({ 
    where: { isActive: true },
    include: { wallet: true }
  })

  const activePeriod = await prisma.diningPeriod.findFirst({
    where: { isActive: true }
  })

  const periodDepositMap = await getStudentPeriodDeposits(activePeriod);

  // Group schedules by date and student
  const scheduleMap = new Map<string, Map<string, any>>();
  allSchedules.forEach(s => {
    const dStr = new Date(s.date).toISOString().split('T')[0];
    if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
    scheduleMap.get(dStr)!.set(s.studentId, s);
  });

  let totalMeals = 0
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dStr = d.toISOString().split('T')[0];
    const dailySchedules = scheduleMap.get(dStr) || new Map();
    
    // For each active student, determine if they are eating
    for (const student of students) {
      const balance = student.wallet?.balance || 0;
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);

      if (!autoOff) {
        const s = dailySchedules.get(student.id);
        if (s) {
          if (s.lunch) totalMeals++
          if (s.dinner) totalMeals++
        } else {
          totalMeals += 2 // Default: 2 meals per day
        }
      }
    }
  }

  const mealRate = totalMeals > 0 ? totalBazaarCost / totalMeals : 0
  return { totalBazaarCost, totalMeals, mealRate: Number(mealRate.toFixed(2)) }
}

/**
 * Settles a dining period by calculating the exact cost of consumed meals based
 * on the dynamic bazaar rate and permanently deducting it from students' wallets.
 */
export async function settleDiningPeriod(periodId: string, nextPeriodStartDate?: Date) {
  const period = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
  if (!period) throw new Error("Dining period not found")
  if (period.isSettled) return { message: "Already settled", period }

  const { mealRate } = await calculateDynamicMealRate(period.startDate, period.endDate)

  const students = await prisma.student.findMany({
    where: { isActive: true },
    include: { wallet: true },
  })

  const periodDepositMap = await getStudentPeriodDeposits(period);

  const msInDay = 24 * 60 * 60 * 1000
  const periodStart = new Date(period.startDate)
  const periodEnd = new Date(period.endDate)
  
  // Calculate exactly how many days are in the period boundary (inclusive)
  const daysInMonth = Math.round((periodEnd.getTime() - periodStart.getTime()) / msInDay) + 1
  
  // Stretch periodEnd to the very end of the day so Prisma catches schedules on the last day
  periodEnd.setUTCHours(23, 59, 59, 999)

  await prisma.$transaction(async (tx) => {
    for (const student of students) {
      const balance = student.wallet?.balance || 0;
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      let monthlyMealCount = 0;
      
      const monthlySchedules = await tx.mealSchedule.findMany({
        where: {
          studentId: student.id,
          date: { gte: periodStart, lte: periodEnd },
        },
      })

      // Build schedule map for this student
      const studentScheduleMap = new Map();
      for (const schedule of monthlySchedules) {
        const dStr = new Date(schedule.date).toISOString().split('T')[0];
        studentScheduleMap.set(dStr, schedule);
      }

      // Iterate day by day, checking auto-off for each day
      const iterDate = new Date(periodStart);
      while (iterDate <= periodEnd) {
        const { autoOff } = isStudentAutoOff(balance, period, iterDate, periodDeposit);
        if (!autoOff) {
          const dStr = iterDate.toISOString().split('T')[0];
          const s = studentScheduleMap.get(dStr);
          if (s) {
            if (s.lunch) monthlyMealCount += 1;
            if (s.dinner) monthlyMealCount += 1;
          } else {
            monthlyMealCount += 2; // Default: both meals ON
          }
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }

      let remainingBalance = student.wallet?.balance || 0;

      if (monthlyMealCount > 0) {
        const cost = monthlyMealCount * mealRate
        remainingBalance -= cost;

        if (cost > 0) {
          await tx.wallet.update({
            where: { studentId: student.id },
            data: { balance: { decrement: cost } },
          })

          await tx.transaction.create({
            data: {
              studentId: student.id,
              type: "MEAL_DEDUCTION",
              amount: cost,
              description: `Settlement for ${period.title} (${monthlyMealCount} meals @ ${mealRate.toFixed(2)})`,
            },
          })
        }
      }
      // Record the rollover in the transaction history as requested by the user
      if (remainingBalance > 0) {
        const rolloverDate = nextPeriodStartDate ? new Date(nextPeriodStartDate) : new Date();

        // 1. Withdraw it from the old period via an ADJUSTMENT
        await tx.wallet.update({
          where: { studentId: student.id },
          data: { balance: { decrement: remainingBalance } },
        })
        await tx.transaction.create({
          data: {
            studentId: student.id,
            type: "ADJUSTMENT",
            amount: remainingBalance,
            description: `Period Closed: Balance carried forward to next month`,
            createdAt: rolloverDate,
          },
        })

        // 2. Deposit it into the new period so they see it in their history
        await tx.wallet.update({
          where: { studentId: student.id },
          data: { balance: { increment: remainingBalance } },
        })
        await tx.transaction.create({
          data: {
            studentId: student.id,
            type: "DEPOSIT",
            amount: remainingBalance,
            description: `Rollover: Starting balance from previous month`,
            createdAt: rolloverDate,
          },
        })
      }

      // Fire and forget email notification
      sendEmail(
        student.email,
        `Monthly Dining Settlement: ${period.title}`,
        `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f766e;">Monthly Settlement Complete</h2>
          <p>Hello <strong>${student.name}</strong>,</p>
          <p>The dining period <strong>${period.title}</strong> has been officially settled.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Total Meals Consumed:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${monthlyMealCount}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Final Meal Rate:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${mealRate.toFixed(2)} BDT</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Total Cost Deducted:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #b91c1c;">-${(monthlyMealCount > 0 ? monthlyMealCount * mealRate : 0).toFixed(2)} BDT</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Balance Rolled Over:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f766e;">+${remainingBalance > 0 ? remainingBalance.toFixed(2) : "0.00"} BDT</td>
            </tr>
          </table>
          <p style="font-size: 14px;">The remaining balance has been automatically transferred to your account for the next month.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
        </div>`
      )
    }

    await tx.diningPeriod.update({
      where: { id: period.id },
      data: { isSettled: true },
    })
  }, {
    timeout: 20000,
  })

  return { message: "Period settled successfully", periodId }
}

