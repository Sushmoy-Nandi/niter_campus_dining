import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { deposits } = body // Array of { diningId, amount, description }

    if (!deposits || !Array.isArray(deposits) || deposits.length === 0) {
      return NextResponse.json({ error: "No deposits provided" }, { status: 400 })
    }

    const LOW_BALANCE_THRESHOLD = 3000;
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process deposits sequentially to avoid transaction deadlocks
    for (const d of deposits) {
      try {
        const student = await prisma.student.findFirst({
          where: { 
            OR: [
              { diningId: d.diningId },
              { studentId: d.diningId }
            ]
          },
          include: { wallet: true }
        })

        if (!student) {
          results.failed++;
          results.errors.push(`Student not found for ID: ${d.diningId}`);
          continue;
        }

        const amount = parseFloat(d.amount);
        if (isNaN(amount) || amount <= 0) {
          results.failed++;
          results.errors.push(`Invalid amount for ID: ${d.diningId}`);
          continue;
        }

        const oldBalance = student.wallet?.balance || 0;
        const newBalance = oldBalance + amount;

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              studentId: student.id,
              type: "DEPOSIT",
              amount,
              description: d.description || "Bulk deposit",
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
              details: `Bulk deposit of ${amount} BDT. ${d.description || ""}`,
            },
          })

          // Auto-turn on meals if threshold reached
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
        })

        results.successful++;

        // Send email asynchronously
        sendEmail(
          student.email,
          "Deposit Confirmation - Campus Dining",
          `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f766e;">Deposit Successful</h2>
            <p>Hello <strong>${student.name}</strong>,</p>
            <p>A deposit of <strong>${amount.toFixed(2)} BDT</strong> has been successfully added to your dining wallet.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Thank you,<br/>Campus Dining Administration</p>
          </div>`
        ).catch(e => console.error("Bulk email error:", e))

      } catch (err: any) {
        results.failed++;
        results.errors.push(`Error processing ${d.diningId}: ${err.message}`);
      }
    }

    return NextResponse.json({ 
      message: `Processed ${results.successful} deposits successfully. ${results.failed} failed.`,
      results 
    }, { status: 200 })
    
  } catch (error) {
    console.error("Bulk deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
