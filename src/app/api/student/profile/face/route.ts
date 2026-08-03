import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { faceDescriptor } = body

    if (!faceDescriptor) {
      return NextResponse.json({ error: "Face descriptor is required" }, { status: 400 })
    }

    const student = await prisma.student.update({
      where: { userId: session.user.id },
      data: { faceDescriptor },
    })

    return NextResponse.json({ success: true, message: "Face registered successfully." })
  } catch (error) {
    console.error("Face registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
