import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBkashWebhookSecret } from "@/lib/secrets";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    
    // Fail-closed secret: unset env var throws (caught below → 500) rather than
    // falling back to a public hardcoded value.
    const expectedSecret = getBkashWebhookSecret();
    
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
      const trxId = trxIdMatch[1].toUpperCase();
      const amountStr = amountMatch[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      const senderNumber = senderMatch ? senderMatch[1] : null;

      // Guard against a malformed amount ("Tk .00", corrupted SMS). Without this
      // a NaN would be written into the ledger and poison every downstream sum.
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({
          error: "Parsed an invalid amount from message",
          receivedBody: messageBody
        }, { status: 400 });
      }

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
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ 
        error: "Failed to extract TrxID or Amount from message", 
        receivedBody: messageBody 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
