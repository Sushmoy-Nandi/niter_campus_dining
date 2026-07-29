import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/validations"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = registerSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      )
    }

    const { studentId, name, email, department, session, whatsapp, password } = validated.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const existingStudent = await prisma.student.findUnique({ where: { studentId } })
    if (existingStudent) {
      return NextResponse.json({ error: "Student ID already registered" }, { status: 400 })
    }

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
        data: { studentId, diningId, name, email, department, session, whatsapp, userId: user.id },
      })

      await tx.wallet.create({
        data: { studentId: student.id, balance: 0 },
      })

      return student
    })

    return NextResponse.json({ message: "Account created successfully", studentId: result.studentId }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
