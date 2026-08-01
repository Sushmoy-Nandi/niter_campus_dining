import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Fetch active polls with user's vote if exists
    const polls = await prisma.poll.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } }
          }
        },
        votes: {
          where: { studentId: student.id }
        }
      }
    })

    return NextResponse.json(polls)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch polls" }, { status: 500 })
  }
}

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

    const body = await req.json()
    const { pollId, optionId: rawOptionId, pollOptionId } = body
    const optionId = rawOptionId || pollOptionId

    if (!pollId || !optionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const existingVote = await prisma.pollVote.findUnique({
      where: {
        pollId_studentId: {
          pollId,
          studentId: student.id
        }
      }
    })

    if (existingVote) {
      // Update vote
      await prisma.pollVote.update({
        where: { id: existingVote.id },
        data: { optionId }
      })
    } else {
      // Create new vote
      await prisma.pollVote.create({
        data: {
          pollId,
          optionId,
          studentId: student.id
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 })
  }
}
