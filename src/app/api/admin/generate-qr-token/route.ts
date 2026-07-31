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

    // Create a secure token. We do not use expiresIn because the check-in route 
    // strictly validates that the 'date' (YYYY-MM-DD) perfectly matches today's date.
    // This allows admins to generate QR codes days in advance without them breaking.
    const token = jwt.sign({ date, mealType }, secret)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("Generate QR Token Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
