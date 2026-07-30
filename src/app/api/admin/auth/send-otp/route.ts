import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Find the admin user
    const adminUser = await prisma.user.findFirst({
      where: { email, role: "ADMIN" },
    });

    if (!adminUser || !adminUser.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, adminUser.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration to 5 minutes from now
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save to database
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { otpCode, otpExpiresAt },
    });

    // Send email via Google Apps Script
    const emailPayload = {
      to: adminUser.email,
      subject: "Campus Dining - Admin Login OTP",
      htmlBody: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Admin Login Verification</h2>
          <p style="color: #555; font-size: 16px;">You are trying to log into the Campus Dining Admin Dashboard.</p>
          <p style="color: #555; font-size: 16px;">Your verification code is:</p>
          <div style="background-color: #fff; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #db2777;">${otpCode}</span>
          </div>
          <p style="color: #777; font-size: 14px; text-align: center;">This code will expire in 5 minutes.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
      plainBody: `Your Admin Login OTP is: ${otpCode}. It will expire in 5 minutes.`
    };

    if (process.env.GOOGLE_SCRIPT_EMAIL_URL) {
      await fetch(process.env.GOOGLE_SCRIPT_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });
    } else {
      console.error("GOOGLE_SCRIPT_EMAIL_URL is not set!");
      // Fallback for development if URL is missing
      console.log("Generated OTP for admin:", otpCode);
    }

    return NextResponse.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
