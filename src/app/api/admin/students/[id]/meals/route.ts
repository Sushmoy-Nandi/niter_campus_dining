import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerLiveSheetSync } from "@/lib/google-sync"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { date, lunch, dinner } = body

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    const mealDate = new Date(date)
    mealDate.setUTCHours(0, 0, 0, 0)

    const student = await prisma.student.findFirst({ where: { OR: [{ id }, { studentId: id }] } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const studentCuid = student.id;

    const schedule = await prisma.mealSchedule.upsert({
      where: {
        studentId_date: { studentId: studentCuid, date: mealDate },
      },
      update: {
        lunch: lunch ?? true,
        dinner: dinner ?? true,
        adminOverride: true,
      },
      create: {
        studentId: studentCuid,
        date: mealDate,
        lunch: lunch ?? true,
        dinner: dinner ?? true,
        adminOverride: true,
      },
    })

    triggerLiveSheetSync();

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error("Admin update meals error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
