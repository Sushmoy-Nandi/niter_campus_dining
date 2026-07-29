import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { LOW_BALANCE_THRESHOLD } from "@/lib/constants"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        wallet: { balance: { lt: LOW_BALANCE_THRESHOLD } },
      },
      include: { wallet: true },
    })

    let emailsSent = 0;
    
    for (const student of students) {
      if (student.email) {
        // Fire and forget (do not await, to prevent long blocking)
        sendEmail(
          student.email,
          "Urgent: Low Dining Balance Warning",
          `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #b91c1c;">Low Balance Alert</h2>
            <p>Hello <strong>${student.name}</strong>,</p>
            <p>Your current dining wallet balance is <strong>${(student.wallet?.balance || 0).toFixed(2)} BDT</strong>.</p>
            <p>This is below the minimum threshold of ${LOW_BALANCE_THRESHOLD} BDT. To ensure your meals are not interrupted, please make a deposit as soon as possible.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
          </div>`
        )
        emailsSent++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Low balance alerts triggered for ${emailsSent} students.` 
    })
  } catch (error) {
    console.error("Low balance alert error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
