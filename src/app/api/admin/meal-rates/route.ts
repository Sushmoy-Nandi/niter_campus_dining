import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { mealRateSchema } from "@/lib/validations"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rates = await prisma.mealRate.findMany({
      orderBy: { effectiveFrom: "desc" },
    })

    return NextResponse.json({ rates })
  } catch (error) {
    console.error("Meal rates error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validated = mealRateSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.issues[0].message }, { status: 400 })
    }

    const rate = await prisma.mealRate.create({
      data: validated.data,
    })

    return NextResponse.json({ rate }, { status: 201 })
  } catch (error) {
    console.error("Create meal rate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
