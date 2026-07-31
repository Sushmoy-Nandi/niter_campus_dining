import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import jwt from "jsonwebtoken"
import { getQrTokenSecret } from "@/lib/secrets"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { date, mealType } = await req.json()

    if (!date || !mealType) {
      return NextResponse.json({ error: "Missing date or mealType" }, { status: 400 })
    }

    // Shared, fail-closed secret (AUTH_SECRET → NEXTAUTH_SECRET, else throws).
    const secret = getQrTokenSecret()

    // Create a secure token that expires at the end of the specified day
    // Or just make it expire in 24 hours.
    const token = jwt.sign({ date, mealType }, secret, { expiresIn: '24h' })

    return NextResponse.json({ token })
  } catch (error) {
    console.error("Generate QR Token Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
