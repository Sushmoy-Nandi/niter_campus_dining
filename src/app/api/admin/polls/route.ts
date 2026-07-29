import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } }
          }
        },
        _count: { select: { votes: true } }
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
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { question, options } = body // options is array of strings

    if (!question || !options || options.length < 2) {
      return NextResponse.json({ error: "Question and at least 2 options are required" }, { status: 400 })
    }

    const poll = await prisma.poll.create({
      data: {
        question,
        options: {
          create: options.map((opt: string) => ({ text: opt }))
        }
      },
      include: { options: true }
    })

    return NextResponse.json(poll)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create poll" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { id, isActive } = body

    const poll = await prisma.poll.update({
      where: { id },
      data: { isActive }
    })

    return NextResponse.json(poll)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update poll" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

    await prisma.poll.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete poll" }, { status: 500 })
  }
}
