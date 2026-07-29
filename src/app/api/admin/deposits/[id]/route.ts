import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await props.params
    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    // Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { student: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.type !== "DEPOSIT") {
      return NextResponse.json({ error: "Only deposits can be deleted here" }, { status: 400 })
    }

    const student = transaction.student
    const amount = transaction.amount

    // Perform the deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the transaction record
      await tx.transaction.delete({
        where: { id },
      })

      // Deduct the amount from the student's wallet
      await tx.wallet.update({
        where: { studentId: student.id },
        data: { balance: { decrement: amount } },
      })

      // Log the deletion
      await tx.auditLog.create({
        data: {
          studentId: student.id,
          action: "DEPOSIT_DELETED",
          details: `Admin deleted deposit of ${amount} BDT (Original description: ${transaction.description || "N/A"}).`,
        },
      })
    })

    // Send email to the student asynchronously
    sendEmail(
      student.email,
      "Deposit Removed - Campus Dining",
      `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #b91c1c;">Deposit Removed</h2>
        <p>Hello <strong>${student.name}</strong>,</p>
        <p>A deposit of <strong>${amount.toFixed(2)} BDT</strong> has been removed from your dining wallet by the administration.</p>
        <p>If you believe this is an error, please contact the dining office immediately.</p>
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
      </div>`
    ).catch(e => console.error("Deposit deletion email error:", e))

    return NextResponse.json({ message: "Deposit deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Delete deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
