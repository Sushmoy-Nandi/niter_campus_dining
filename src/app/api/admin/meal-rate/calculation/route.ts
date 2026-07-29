import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateDynamicMealRate } from "@/lib/meal-utils"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get("periodId")
    const month = searchParams.get("month")

    let startDate: Date
    let endDate: Date

    if (periodId) {
      const period = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
      if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 })
      startDate = new Date(period.startDate)
      endDate = new Date(period.endDate)
      endDate.setUTCHours(23, 59, 59, 999)
    } else if (month) {
      const [yearStr, monthStr] = month.split("-")
      const year = parseInt(yearStr)
      const monthIndex = parseInt(monthStr) - 1
      startDate = new Date(Date.UTC(year, monthIndex, 1))
      endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
    } else {
      return NextResponse.json({ error: "periodId or month parameter required" }, { status: 400 })
    }

    const result = await calculateDynamicMealRate(startDate, endDate)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Calculation error:", error)
    return NextResponse.json({ error: "Failed to calculate meal rate" }, { status: 500 })
  }
}
