import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Validate the binary file header (Magic Bytes) for security
// This ensures they cannot upload raw Javascript, PHP, or HTML files disguised as images.
function isValidImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return true
  }

  // WEBP: RIFF (first 4 bytes) and WEBP (bytes 8-11)
  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
  if (isRiff && buffer.length >= 12) {
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    if (isWebp) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { imageBase64 } = await req.json()
    if (!imageBase64) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // 1. Check if it's a valid Data URI format
    const matches = imageBase64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: "Invalid image format structure" }, { status: 400 })
    }

    const mimeType = matches[1]
    const base64Data = matches[2]

    // 2. Security: Size check (Ensure the base64 string isn't carrying massive payloads)
    // 1MB of binary is roughly 1.37MB in base64 string length
    if (base64Data.length > 1.4 * 1024 * 1024) {
      return NextResponse.json({ error: "Image file is too large. Max allowed is 1MB." }, { status: 400 })
    }

    // Convert to binary buffer
    const buffer = Buffer.from(base64Data, "base64")

    // 3. Security: Check actual binary file signature (Magic Bytes)
    if (!isValidImageSignature(buffer)) {
      return NextResponse.json({ error: "Security Alert: Invalid image file signature detected. Upload only genuine JPG/PNG/WEBP files." }, { status: 400 })
    }

    // 4. Save to User image field in Database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageBase64 },
      select: { image: true }
    })

    return NextResponse.json({ 
      success: true, 
      message: "Profile picture uploaded successfully", 
      image: updatedUser.image 
    })

  } catch (error) {
    console.error("Image upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: null }
    })

    return NextResponse.json({ success: true, message: "Profile picture deleted" })
  } catch (error) {
    console.error("Image deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
