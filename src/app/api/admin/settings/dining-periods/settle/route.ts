import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { settleDiningPeriod } from "@/lib/meal-utils"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { periodId } = await req.json()
    if (!periodId) {
      return NextResponse.json({ error: "Period ID is required" }, { status: 400 })
    }

    const currentPeriod = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
    if (!currentPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    if (currentPeriod.isSettled) {
      return NextResponse.json({ error: "Period is already settled" }, { status: 400 })
    }

    const MS_IN_DAY = 24 * 60 * 60 * 1000

    // Next period starts the day after the current one ends (UTC-midnight).
    const start = new Date(currentPeriod.startDate)
    const end = new Date(currentPeriod.endDate)

    // Mirror the EXACT length of the period just closed (inclusive day count) rather
    // than assuming a calendar month, so 28-, 30- or 35-day periods all roll forward
    // to an identically sized window. This is what makes settlement universal.
    const periodDays = Math.round((end.getTime() - start.getTime()) / MS_IN_DAY) + 1

    const nextStartDate = new Date(currentPeriod.endDate)
    nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1)
    nextStartDate.setUTCHours(0, 0, 0, 0)

    const nextEnd = new Date(nextStartDate)
    nextEnd.setUTCDate(nextEnd.getUTCDate() + (periodDays - 1))

    // Carry the deposit deadline forward by the same offset it had inside the old
    // period (e.g. "deadline was day 5" → day 5 of the new period). If the old
    // period had no deadline, the new one has none either.
    let nextDeadline: Date | null = null
    if (currentPeriod.depositDeadline) {
      const deadlineOffsetDays = Math.round(
        (new Date(currentPeriod.depositDeadline).getTime() - start.getTime()) / MS_IN_DAY
      )
      nextDeadline = new Date(nextStartDate)
      nextDeadline.setUTCDate(nextDeadline.getUTCDate() + deadlineOffsetDays)
    }

    // Build a human title; guarantee uniqueness (title is @unique) so a repeat/retry
    // or a same-named month can never crash settlement with a P2002.
    const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    const baseTitle = `${monthFmt.format(nextStartDate)} ${nextStartDate.getUTCDate()} - ${monthFmt.format(nextEnd)} ${nextEnd.getUTCDate()}, ${nextEnd.getUTCFullYear()}`
    let nextTitle = baseTitle
    for (let attempt = 2; attempt < 100; attempt++) {
      const clash = await prisma.diningPeriod.findUnique({ where: { title: nextTitle } })
      if (!clash) break
      nextTitle = `${baseTitle} (${attempt})`
    }

    // Run the settlement FIRST. If it throws (e.g. a concurrent double-settle claimed
    // the period), we bail out before creating any new period — so a failed settle
    // can never leave an orphaned empty period behind.
    const result = await settleDiningPeriod(periodId, nextStartDate)

    // Settlement succeeded and is durable — now create the next period, inheriting
    // every rule from the one just closed so the admin never has to reconfigure them.
    const nextPeriod = await prisma.diningPeriod.create({
      data: {
        title: nextTitle,
        startDate: nextStartDate,
        endDate: nextEnd,
        depositDeadline: nextDeadline,
        minimumDeposit: currentPeriod.minimumDeposit,
        minimumBalance: currentPeriod.minimumBalance,
        isActive: false,
      }
    })

    // Mark old period inactive and new period active
    await prisma.diningPeriod.updateMany({
      where: { id: { not: nextPeriod.id } },
      data: { isActive: false }
    })
    await prisma.diningPeriod.update({
      where: { id: nextPeriod.id },
      data: { isActive: true }
    })

    return NextResponse.json({
      ...result,
      message: `Period settled. Auto-created new period: ${nextTitle}`
    })
  } catch (error: any) {
    if (error?.message === "ALREADY_SETTLED") {
      return NextResponse.json({ error: "Period is already settled" }, { status: 400 })
    }
    console.error("Settle dining period error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

