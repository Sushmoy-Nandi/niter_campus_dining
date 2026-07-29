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

    // Determine the next period's dates (e.g. next month)
    const nextStart = new Date(currentPeriod.endDate)
    nextStart.setDate(nextStart.getDate() + 1)
    
    const nextEnd = new Date(nextStart)
    nextEnd.setMonth(nextEnd.getMonth() + 1)
    nextEnd.setDate(nextEnd.getDate() - 1)

    const nextTitle = `${nextStart.toLocaleString('default', { month: 'short' })} - ${nextEnd.toLocaleString('default', { month: 'short' })} ${nextStart.getFullYear()}`

    // Create the next period automatically
    const nextPeriod = await prisma.diningPeriod.create({
      data: {
        title: nextTitle,
        startDate: nextStart,
        endDate: nextEnd,
        isActive: false // We will set it active right after
      }
    })

    // Run the settlement which will rollover the balance using nextStart as the rollover date
    const result = await settleDiningPeriod(periodId, nextStart)

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
    console.error("Settle dining period error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

