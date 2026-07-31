import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePagination } from "@/lib/utils"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const { page, limit, skip } = parsePagination(searchParams)
    const type = searchParams.get("type")

    const where: any = { studentId: student.id }
    if (type) where.type = type

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
