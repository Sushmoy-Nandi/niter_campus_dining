import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { amount, method, accountNo } = body

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !method || !accountNo) {
      return NextResponse.json({ error: "Invalid refund request data" }, { status: 400 })
    }

    // Check if there are existing pending requests
    const pendingRequest = await prisma.refundRequest.findFirst({
      where: { studentId: student.id, status: "PENDING" },
    })

    if (pendingRequest) {
      return NextResponse.json({ error: "You already have a pending refund request" }, { status: 400 })
    }

    const request = await prisma.refundRequest.create({
      data: {
        studentId: student.id,
        amount: parsedAmount,
        method,
        accountNo,
      },
    })

    return NextResponse.json({ message: "Refund request submitted successfully", request }, { status: 201 })
  } catch (error) {
    console.error("Refund request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
