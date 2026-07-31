import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        wallet: true,
        user: { select: { image: true } },
        _count: { select: { transactions: true, mealSchedules: true } },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error("Profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name, department, session: studentSession, whatsapp } = body

    if (!name || !department || !studentSession) {
      return NextResponse.json({ error: "Name, department, and session are required" }, { status: 400 })
    }

    // Update the student profile
    const student = await prisma.student.update({
      where: { userId: session.user.id },
      data: {
        name,
        department,
        session: studentSession,
        whatsapp: whatsapp || null,
      },
    })

    // Also update the core User table name so it's in sync across the app
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name }
    })

    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
