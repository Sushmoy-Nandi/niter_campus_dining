import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get("periodId")
    const month = searchParams.get("month") // fallback

    let whereClause = {}
    
    if (periodId && periodId !== "null" && periodId !== "undefined" && periodId !== "") {
      const period = await prisma.diningPeriod.findUnique({ where: { id: periodId } })
      if (period) {
        const endDate = new Date(period.endDate)
        endDate.setUTCHours(23, 59, 59, 999)

        whereClause = {
          date: {
            gte: period.startDate,
            lte: endDate,
          },
        }
      }
    } else if (month) {
      const [yearStr, monthStr] = month.split("-")
      const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1)
      const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0, 23, 59, 59, 999)

      whereClause = {
        date: {
          gte: startDate,
          lte: endDate,
        },
      }
    }

    const bazaars = await prisma.bazaar.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      include: { items: true }
    })

    return NextResponse.json(bazaars)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch bazaar records" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { date, name, details, amount, items } = body

    const bazaar = await prisma.bazaar.create({
      data: {
        date: new Date(date),
        name,
        details,
        amount: parseFloat(amount),
        items: {
          create: Array.isArray(items) ? items.map((i: any) => ({
            name: i.name,
            quantity: parseFloat(i.quantity),
            unit: i.unit,
            price: parseFloat(i.price)
          })) : []
        }
      },
      include: { items: true }
    })

    return NextResponse.json(bazaar)
  } catch (error) {
    return NextResponse.json({ error: "Failed to add bazaar record" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 })
    }

    await prisma.bazaar.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete bazaar record" }, { status: 500 })
  }
}
