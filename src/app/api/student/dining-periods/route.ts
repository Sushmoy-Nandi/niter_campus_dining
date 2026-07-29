import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
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
