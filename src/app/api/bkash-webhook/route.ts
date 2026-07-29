import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    
    // Check if the secret matches the environment variable (or a strong hardcoded fallback if env is missing)
    const expectedSecret = process.env.BKASH_WEBHOOK_SECRET || "niter_dining_secure_123!";
    
    if (secret !== expectedSecret) {
      console.warn("Unauthorized webhook attempt blocked.");
      return NextResponse.json({ error: "Unauthorized request" }, { status: 401 });
    }

    const text = await req.text(); // Depending on how the SMS Forwarder sends it
    // Usually SMS forwarder sends JSON with a message field
    let messageBody = text;
    try {
      const json = JSON.parse(text);
      messageBody = json.message || json.body || json.text || text;
    } catch(e) {
      // It's just plain text
    }

    if (!messageBody) {
      return NextResponse.json({ error: "No message content" }, { status: 400 });
    }

    // Typical bKash SMS: "You have received Tk 1,200.00 from 01XXXXXXXXX. Ref xyz. Fee Tk 0.00. Balance Tk 5,000.00. TrxID 9H1A2B3C at 12/08/2026 14:05"
    // Extract TrxID
    const trxIdMatch = messageBody.match(/TrxID\s+([A-Z0-9]+)/i);
    // Extract Amount (Tk 1,200.00)
    const amountMatch = messageBody.match(/Tk\s+([\d,]+\.\d{2})/i) || messageBody.match(/Tk\s+([\d,]+)/i);
    // Extract Sender Number (from 01XXXXXXXXX)
    const senderMatch = messageBody.match(/from\s+(01\d{9})/i);

    if (trxIdMatch && amountMatch) {
      const trxId = trxIdMatch[1];
      const amountStr = amountMatch[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      const senderNumber = senderMatch ? senderMatch[1] : null;

      // Check if it already exists
      const existing = await prisma.bkashLedger.findUnique({ where: { trxId } });
      if (!existing) {
        await prisma.bkashLedger.create({
          data: {
            trxId,
            amount,
            senderNumber,
            status: "UNCLAIMED"
          }
        });
        console.log(`Saved new bKash TrxID: ${trxId} for Tk ${amount}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
