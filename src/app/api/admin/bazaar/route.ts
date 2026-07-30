import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerLiveSheetSync } from "@/lib/google-sync"
import { z } from "zod"

export const dynamic = 'force-dynamic'

// 1. Create a strict validation schema for Bazaar data
const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.preprocess((val) => Number(val), z.number().min(0)),
  unit: z.string().min(1, "Unit is required"),
  price: z.preprocess((val) => Number(val), z.number().min(0)),
})

const bazaarSchema = z.object({
  date: z.string().or(z.date()), // Accepts string dates or Date objects
  name: z.string().min(1, "Bazaar name is required"),
  details: z.string().optional().default(""),
  amount: z.preprocess((val) => Number(val), z.number().min(0, "Amount must be valid")),
  items: z.array(itemSchema).optional().default([]),
})

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
    console.error("Bazaar GET error:", error) // Added error logging
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
    
    // 2. Validate the incoming data before touching the database
    const validated = bazaarSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.issues[0].message }, { status: 400 })
    }

    const { date, name, details, amount, items } = validated.data

    const bazaar = await prisma.bazaar.create({
      data: {
        date: new Date(date),
        name,
        details,
        amount,
        items: {
          create: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            price: i.price
          }))
        }
      },
      include: { items: true }
    })

    // 3. Trigger Google Sheets live sync in background
    await triggerLiveSheetSync();

    return NextResponse.json(bazaar, { status: 201 })
  } catch (error) {
    console.error("Bazaar POST error:", error) // Added error logging
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

    // 4. Trigger Google Sheets live sync when a record is deleted
    await triggerLiveSheetSync();

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Bazaar DELETE error:", error) // Added error logging
    return NextResponse.json({ error: "Failed to delete bazaar record" }, { status: 500 })
  }
}