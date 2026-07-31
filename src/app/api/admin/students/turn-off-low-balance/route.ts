import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBDTTodayStartUTC, periodEndInclusive } from "@/lib/meal-utils"

const DEFAULT_LOW_BALANCE_THRESHOLD = 3000;

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Both the threshold and the turn-off window are derived from the ACTIVE dining period,
    // so this action stays correct for any future period length/config. We fall back to the
    // default threshold + calendar month only when no period is active.
    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })
    const threshold = activePeriod?.minimumDeposit ?? DEFAULT_LOW_BALANCE_THRESHOLD

    // 1. Find all active students with low balance
    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        wallet: {
          balance: { lt: threshold }
        }
      },
      include: { wallet: true }
    })

    if (students.length === 0) {
      return NextResponse.json({ message: "No active students have a low balance." })
    }

    // 2. Build the UTC-midnight day keys to turn off: from tomorrow (BDT) through the end of
    // the active period (inclusive). Keying in UTC — the same convention the whole app uses —
    // guarantees these upserts collide with the existing @@unique([studentId, date]) rows
    // instead of silently creating duplicates that no other query would ever read.
    const today = getBDTTodayStartUTC()
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const windowEnd = activePeriod
      ? periodEndInclusive(activePeriod.endDate)
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999))

    const datesToOff: Date[] = []
    const d = new Date(tomorrow)
    while (d <= windowEnd) {
      datesToOff.push(new Date(d))
      d.setUTCDate(d.getUTCDate() + 1)
    }

    if (datesToOff.length === 0) {
      return NextResponse.json({ message: "No future dates remain in the current period to turn off." })
    }

    // 3. For each student, upsert their schedules for these dates to be OFF
    let updatedCount = 0;

    for (const student of students) {
      for (const date of datesToOff) {
        await prisma.mealSchedule.upsert({
          where: {
            studentId_date: { studentId: student.id, date: date }
          },
          update: {
            lunch: false,
            dinner: false,
          },
          create: {
            studentId: student.id,
            date: date,
            lunch: false,
            dinner: false,
          }
        })
      }
      updatedCount++;
    }

    return NextResponse.json({
      message: `Turned OFF future meals for ${updatedCount} low-balance students.`
    })
  } catch (error) {
    console.error("Turn off low balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
