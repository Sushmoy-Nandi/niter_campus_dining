import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { depositSchema } from "@/lib/validations"
import { sendEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const [deposits, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { type: "DEPOSIT" },
        include: { student: { select: { name: true, diningId: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: { type: "DEPOSIT" } }),
    ])

    return NextResponse.json({
      deposits,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Deposits error:", error)
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
    const validated = depositSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.issues[0].message }, { status: 400 })
    }

    const { diningId, amount, description } = validated.data

    const student = await prisma.student.findUnique({
      where: { diningId },
      include: { wallet: true }
    })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const LOW_BALANCE_THRESHOLD = 3000;
    const oldBalance = student.wallet?.balance || 0;
    const newBalance = oldBalance + amount;

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          studentId: student.id,
          type: "DEPOSIT",
          amount,
          description: description || "Manual deposit by admin",
        },
      })

      await tx.wallet.update({
        where: { studentId: student.id },
        data: { balance: { increment: amount } },
      })

      await tx.auditLog.create({
        data: {
          studentId: student.id,
          action: "DEPOSIT",
          details: `Admin deposit of ${amount} BDT. ${description || ""}`,
        },
      })

      // Auto-turn on meals if they just crossed the threshold
      if (oldBalance < LOW_BALANCE_THRESHOLD && newBalance >= LOW_BALANCE_THRESHOLD) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
        
        await tx.mealSchedule.updateMany({
          where: {
            studentId: student.id,
            date: { gte: tomorrow }
          },
          data: {
            lunch: true,
            dinner: true
          }
        })
      }

      return transaction
    })

    // Fire and forget email notification
    sendEmail(
      student.email,
      "Deposit Confirmation - Campus Dining",
      `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f766e;">Deposit Successful</h2>
        <p>Hello <strong>${student.name}</strong>,</p>
        <p>A manual deposit of <strong>${amount.toFixed(2)} BDT</strong> has been successfully added to your dining wallet.</p>
        <p>Description: ${description || "Manual deposit by admin"}</p>
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
      </div>`
    )

    return NextResponse.json({ transaction: result }, { status: 201 })
  } catch (error) {
    console.error("Create deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
