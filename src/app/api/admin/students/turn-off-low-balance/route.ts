import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const LOW_BALANCE_THRESHOLD = 3000;

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Find all active students with low balance
    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        wallet: {
          balance: { lt: LOW_BALANCE_THRESHOLD }
        }
      },
      include: { wallet: true }
    })

    if (students.length === 0) {
      return NextResponse.json({ message: "No active students have a low balance." })
    }

    // 2. Generate dates to turn off (from tomorrow to the end of the current month)
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    let datesToOff: Date[] = []
    let d = new Date(tomorrow)
    while (d <= endOfMonth) {
      datesToOff.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }

    // 3. For each student, upsert their schedules for these dates to be OFF
    let updatedCount = 0;
    
    // We do this in a transaction or a loop. A loop with Promise.all is fine since Prisma handles it.
    // However, it can be heavy. Let's do a grouped upsert or loop.
    for (const student of students) {
      for (const date of datesToOff) {
        await prisma.mealSchedule.upsert({
          where: {
            studentId_date: { studentId: student.id, date: date }
          },
          update: {
            lunch: false,
            dinner: false,
          },
          create: {
            studentId: student.id,
            date: date,
            lunch: false,
            dinner: false,
          }
        })
      }
      updatedCount++;
    }

    return NextResponse.json({ 
      message: `Turned OFF future meals for ${updatedCount} low-balance students.` 
    })
  } catch (error) {
    console.error("Turn off low balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
