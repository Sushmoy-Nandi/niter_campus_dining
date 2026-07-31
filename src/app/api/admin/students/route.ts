import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { adminCreateStudentSchema } from "@/lib/validations"
import { parsePagination } from "@/lib/utils"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const { page, limit, skip } = parsePagination(searchParams)
    const active = searchParams.get("active")

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }
    if (active === "true") where.isActive = true
    if (active === "false") where.isActive = false

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { wallet: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ])

    return NextResponse.json({
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Admin students error:", error)
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
    const validated = adminCreateStudentSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.issues[0].message }, { status: 400 })
    }

    const { studentId, name, email, department, session: studentSession, whatsapp, password } = validated.data

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) return NextResponse.json({ error: "Email already exists" }, { status: 400 })

    const existingSid = await prisma.student.findUnique({ where: { studentId } })
    if (existingSid) return NextResponse.json({ error: "Student ID already exists" }, { status: 400 })

    const passwordHash = await hash(password, 12)

    const lastStudent = await prisma.student.findFirst({
      where: { diningId: { startsWith: "DIN-" } },
      orderBy: { diningId: "desc" },
    })

    let nextNum = 1001
    if (lastStudent?.diningId) {
      const parts = lastStudent.diningId.split("-")
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10)
        if (!isNaN(num)) nextNum = num + 1
      }
    }
    const diningId = `DIN-${nextNum}`

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash, role: "STUDENT" },
      })
      const student = await tx.student.create({
        data: { studentId, diningId, name, email, department, session: studentSession, whatsapp, userId: user.id },
      })
      await tx.wallet.create({ data: { studentId: student.id, balance: 0 } })
      return student
    })

    return NextResponse.json({ student: result }, { status: 201 })
  } catch (error) {
    console.error("Create student error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
