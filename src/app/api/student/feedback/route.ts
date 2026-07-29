import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })
    
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const { rating, comment } = await req.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 })
    }

    // Set today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if feedback already exists for today
    const existingFeedback = await prisma.mealFeedback.findFirst({
      where: {
        studentId: student.id,
        date: today
      }
    })

    if (existingFeedback) {
      // Update existing
      await prisma.mealFeedback.update({
        where: { id: existingFeedback.id },
        data: { rating, comment }
      })
    } else {
      // Create new
      await prisma.mealFeedback.create({
        data: {
          studentId: student.id,
          date: today,
          rating,
          comment
        }
      })
    }

    return NextResponse.json({ success: true, message: "Feedback submitted successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id }
    })
    
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingFeedback = await prisma.mealFeedback.findFirst({
      where: {
        studentId: student.id,
        date: today
      }
    })

    return NextResponse.json({ feedback: existingFeedback })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 })
  }
}
