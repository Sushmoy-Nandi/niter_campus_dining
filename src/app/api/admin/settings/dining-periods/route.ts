import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const periods = await prisma.diningPeriod.findMany({
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json({ periods })
  } catch (error) {
    console.error("Fetch dining periods error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, startDate, endDate, depositDeadline, minimumDeposit, minimumBalance } = await req.json()

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const startObj = new Date(startDate)
    const endObj = new Date(endDate)

    if (endObj < startObj) {
      return NextResponse.json({ error: "End date cannot be earlier than start date!" }, { status: 400 })
    }

    const period = await prisma.diningPeriod.create({
      data: {
        title,
        startDate: startObj,
        endDate: endObj,
        depositDeadline: depositDeadline ? new Date(depositDeadline) : null,
        minimumDeposit: minimumDeposit ? parseFloat(minimumDeposit) : 3000,
        minimumBalance: minimumBalance ? parseFloat(minimumBalance) : 200,
      },
    })

    return NextResponse.json({ period })
  } catch (error) {
    console.error("Create dining period error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { settleDiningPeriod } from "@/lib/meal-utils"

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, isActive } = await req.json()

    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (isActive) {
      // Find currently active periods that are NOT this one and haven't been settled
      const activeUnsettledPeriods = await prisma.diningPeriod.findMany({
        where: { id: { not: id }, isActive: true, isSettled: false },
      })

      // Get the new period to know its start date
      const newPeriod = await prisma.diningPeriod.findUnique({ where: { id } })

      // Auto-settle them!
      for (const oldPeriod of activeUnsettledPeriods) {
        try {
          await settleDiningPeriod(oldPeriod.id, newPeriod?.startDate)
        } catch (e) {
          console.error(`Failed to auto-settle period ${oldPeriod.id}`, e)
        }
      }

      // Deactivate all others
      await prisma.diningPeriod.updateMany({
        where: { id: { not: id } },
        data: { isActive: false },
      })
    }

    const period = await prisma.diningPeriod.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({ period })
  } catch (error) {
    console.error("Update dining period error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, title, startDate, endDate, depositDeadline, minimumDeposit, minimumBalance } = await req.json()

    if (!id || !title || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const startObj = new Date(startDate)
    const endObj = new Date(endDate)

    if (endObj < startObj) {
      return NextResponse.json({ error: "End date cannot be earlier than start date!" }, { status: 400 })
    }

    const period = await prisma.diningPeriod.update({
      where: { id },
      data: {
        title,
        startDate: startObj,
        endDate: endObj,
        depositDeadline: depositDeadline ? new Date(depositDeadline) : null,
        minimumDeposit: minimumDeposit ? parseFloat(minimumDeposit) : 3000,
        minimumBalance: minimumBalance ? parseFloat(minimumBalance) : 200,
      },
    })

    return NextResponse.json({ period })
  } catch (error) {
    console.error("Update dining period error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Period ID is required" }, { status: 400 })
    }

    const period = await prisma.diningPeriod.findUnique({ where: { id } })
    if (!period) {
      return NextResponse.json({ error: "Dining period not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Revert settlement side effects if this period was settled
      if (period.isSettled) {
        const settlementTx = await tx.transaction.findMany({
          where: {
            OR: [
              { description: { startsWith: `Settlement for ${period.title}` } },
              { description: { startsWith: `Period Closed: Balance carried forward to next month` } },
              { description: { startsWith: `Rollover: Starting balance from previous month` } },
            ]
          }
        })

        for (const t of settlementTx) {
          if (t.type === "MEAL_DEDUCTION" || t.type === "ADJUSTMENT") {
            await tx.wallet.update({
              where: { studentId: t.studentId },
              data: { balance: { increment: t.amount } }
            })
          } else if (t.type === "DEPOSIT") {
            await tx.wallet.update({
              where: { studentId: t.studentId },
              data: { balance: { decrement: t.amount } }
            })
          }
          await tx.transaction.delete({ where: { id: t.id } })
        }
      }

      await tx.diningPeriod.delete({ where: { id } })
    })

    return NextResponse.json({ message: "Dining period and all related records completely removed" })
  } catch (error) {
    console.error("Delete dining period error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

