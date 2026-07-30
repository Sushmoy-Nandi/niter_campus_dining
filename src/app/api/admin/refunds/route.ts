import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { triggerLiveSheetSync } from "@/lib/google-sync"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requests = await prisma.refundRequest.findMany({
      include: {
        student: {
          select: { name: true, studentId: true, department: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Fetch refund requests error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { id, action } = body

    if (!id || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const request = await prisma.refundRequest.findUnique({ 
      where: { id },
      include: { student: true }
    })
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Guard the status transition inside the transaction: only flip a row that is
      // still PENDING. On a double-approve (e.g. an impatient double-click) the second
      // call matches zero rows, throws, and rolls back before any wallet decrement,
      // so a refund can never be paid out twice.
      const guard = await tx.refundRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: action === "APPROVE" ? "APPROVED" : "REJECTED" },
      })
      if (guard.count === 0) {
        throw new Error("ALREADY_PROCESSED")
      }

      if (action === "APPROVE") {
        await tx.wallet.update({
          where: { studentId: request.studentId },
          data: { balance: { decrement: request.amount } },
        })

        await tx.transaction.create({
          data: {
            studentId: request.studentId,
            type: "REFUND",
            amount: request.amount,
            description: `Refund via ${request.method} (${request.accountNo || "N/A"})`,
          },
        })
      }
      return { id, status: action === "APPROVE" ? "APPROVED" : "REJECTED" }
    })

    const statusText = action === "APPROVE" ? "Approved" : "Rejected";
    const color = action === "APPROVE" ? "#0f766e" : "#b91c1c";
    
    sendEmail(
      request.student.email,
      `Refund Request ${statusText} - Campus Dining`,
      `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: ${color};">Refund Request ${statusText}</h2>
        <p>Hello <strong>${request.student.name}</strong>,</p>
        <p>Your refund request for <strong>${request.amount.toFixed(2)} BDT</strong> via ${request.method} has been <strong>${statusText.toLowerCase()}</strong>.</p>
        ${action === "APPROVE" ? `<p>The amount has been deducted from your dining wallet and will be sent to your account (${request.accountNo || "N/A"}) shortly.</p>` : `<p>Please contact the dining administration for more details.</p>`}
        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
      </div>`
    );

    if (action === "APPROVE") {
      // Trigger Google Sheets auto-sync to deduct the deposit there as well
      await triggerLiveSheetSync();
    }

    return NextResponse.json({ message: `Request ${action.toLowerCase()}d successfully`, result })
  } catch (error: any) {
    if (error?.message === "ALREADY_PROCESSED") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 })
    }
    console.error("Process refund request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
