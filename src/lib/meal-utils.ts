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

/**
 * The current instant expressed as Bangladesh (Asia/Dhaka) wall-clock time.
 * The returned Date's LOCAL getters (getFullYear/getMonth/getDate/getHours…)
 * read out the Dhaka calendar fields regardless of the server's own timezone.
 */
export function getBDTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }))
}

/**
 * UTC-midnight Date matching *today's* calendar date in Bangladesh. This is the
 * canonical "today" used everywhere schedules/periods are keyed, and it is
 * invariant to the server's own timezone (works identically on UTC, GMT+6, or US servers).
 */
export function getBDTTodayStartUTC(): Date {
  const bdt = getBDTNow()
  return new Date(Date.UTC(bdt.getFullYear(), bdt.getMonth(), bdt.getDate()))
}

/**
 * Canonical day key (YYYY-MM-DD) for any stored logical date. Because logical
 * dates are persisted at UTC midnight, the UTC calendar date is the correct,
 * server-timezone-agnostic key. NEVER use getFullYear/getMonth/getDate for keys —
 * those read the server-local day and drift by one on servers west of UTC.
 */
export function toUTCDateKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10)
}

/**
 * A copy of a period's end date stretched to the final millisecond of that day
 * (UTC) so inclusive `lte` range queries reliably capture last-day rows.
 */
export function periodEndInclusive(endDate: Date | string): Date {
  const d = new Date(endDate)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

// Backwards-compatible aliases (previous implementations were server-timezone
// dependent and produced an off-by-one day on non-UTC servers).
export function getTodayInBDT(): Date {
  return getBDTTodayStartUTC()
}

export function getDateString(date: Date): string {
  return toUTCDateKey(date)
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
      createdAt: { gte: activePeriod.startDate, lte: periodEndInclusive(activePeriod.endDate) }
    }
  });
  const map = new Map<string, number>();
  for (const d of deposits) {
    map.set(d.studentId, d._sum.amount || 0);
  }
  return map;
}

/**
 * Total DEPOSIT amount for ONE student within a dining period.
 * Single source of truth for the period-deposit bound: the upper edge is the
 * INCLUSIVE end of the period's last calendar day (23:59:59.999), so a deposit
 * made at any time on the final day is always counted. Every route that needs a
 * student's period deposit must call this instead of building the range inline,
 * otherwise a same-day deposit silently drops out of auto-off / invoice math.
 */
export async function getStudentPeriodDeposit(studentId: string, activePeriod: any): Promise<number> {
  if (!activePeriod) return 0;
  const deposits = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      studentId,
      type: "DEPOSIT",
      createdAt: { gte: activePeriod.startDate, lte: periodEndInclusive(activePeriod.endDate) }
    }
  });
  return deposits._sum.amount || 0;
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
        // A student is fine if they either deposited the minimum amount this period OR already have a sufficient balance
        if (periodDeposit < activePeriod.minimumDeposit && balance < activePeriod.minimumDeposit) {
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
    const dStr = toUTCDateKey(s.date);
    if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
    scheduleMap.get(dStr)!.set(s.studentId, s);
  });

  let totalMeals = 0
  const iter = new Date(startDate)
  const rangeEnd = periodEndInclusive(endDate)
  while (iter <= rangeEnd) {
    const dStr = toUTCDateKey(iter);
    const dailySchedules = scheduleMap.get(dStr) || new Map();

    // For each active student, determine if they are eating
    for (const student of students) {
      const balance = student.wallet?.balance || 0;
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      const { autoOff } = isStudentAutoOff(balance, activePeriod, iter, periodDeposit);

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
    iter.setUTCDate(iter.getUTCDate() + 1)
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

  // Notifications are buffered and only sent after the transaction commits,
  // so a rolled-back settlement can never email a false "complete" notice.
  const settlementEmails: { to: string; subject: string; html: string }[] = []

  await prisma.$transaction(async (tx) => {
    // Atomically claim this period for settlement. Only the first concurrent call
    // flips isSettled false→true and matches a row; a racing double-settle matches
    // zero rows, throws, and rolls back before any wallet is touched — so meal costs
    // and rollovers can never be applied twice.
    const claim = await tx.diningPeriod.updateMany({
      where: { id: period.id, isSettled: false },
      data: { isSettled: true },
    })
    if (claim.count === 0) {
      throw new Error("ALREADY_SETTLED")
    }

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
        const dStr = toUTCDateKey(schedule.date);
        studentScheduleMap.set(dStr, schedule);
      }

      // Iterate day by day, checking auto-off for each day
      const iterDate = new Date(periodStart);
      const rangeEnd = periodEndInclusive(period.endDate);
      while (iterDate <= rangeEnd) {
        const { autoOff } = isStudentAutoOff(balance, period, iterDate, periodDeposit);
        if (!autoOff) {
          const dStr = toUTCDateKey(iterDate);
          const s = studentScheduleMap.get(dStr);
          if (s) {
            if (s.lunch) monthlyMealCount += 1;
            if (s.dinner) monthlyMealCount += 1;
          } else {
            monthlyMealCount += 2; // Default: both meals ON
          }
        }
        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
      }

      let remainingBalance = student.wallet?.balance || 0;

      if (monthlyMealCount > 0) {
        const cost = monthlyMealCount * mealRate
        // Deduct the meal cost exactly once. The wallet's .balance ALREADY reflects
        // all deposits made during the period, so we only need to subtract the cost.
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
      // Record the rollover in the transaction history as requested by the user.
      // At this point remainingBalance = (original wallet balance) - (meal cost).
      if (remainingBalance > 0) {
        const rolloverDate = nextPeriodStartDate ? new Date(nextPeriodStartDate) : new Date();

        // 1. Withdraw it from the old period via an ADJUSTMENT (decrement the wallet)
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

        // 2. Deposit it into the new period so they see it in their history (increment the wallet back)
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

      // Buffer the notification; it is flushed only after the transaction commits.
      settlementEmails.push({
        to: student.email,
        subject: `Monthly Dining Settlement: ${period.title}`,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
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
      })
    }

    // isSettled was already flipped by the atomic claim at the top of this
    // transaction; no second write is needed here.
  }, {
    timeout: 20000,
  })

  // Transaction committed successfully — now flush the buffered notifications.
  // Each send is independently guarded so one failed email cannot abort the rest,
  // and the settlement itself is already durable regardless of email delivery.
  for (const mail of settlementEmails) {
    sendEmail(mail.to, mail.subject, mail.html).catch((err) => {
      console.error(`Settlement email failed for ${mail.to}:`, err)
    })
  }

  return { message: "Period settled successfully", periodId }
}

