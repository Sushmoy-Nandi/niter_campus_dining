import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerLiveSheetSync } from "@/lib/google-sync";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { wallet: true }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await req.json();
    const { trxId } = body;

    if (!trxId) {
      return NextResponse.json({ error: "TrxID is required" }, { status: 400 });
    }

    const normalizedTrxId = trxId.toUpperCase();

    // Check BkashLedger
    const bkashRecord = await prisma.bkashLedger.findUnique({
      where: { trxId: normalizedTrxId }
    });

    if (!bkashRecord) {
      return NextResponse.json(
        { error: "TrxID not found. If you just sent money, please wait a minute for the SMS to be processed and try again." }, 
        { status: 404 }
      );
    }

    if (bkashRecord.status === "CLAIMED") {
      return NextResponse.json(
        { error: "This TrxID has already been claimed." },
        { status: 400 }
      );
    }

    // Process the deposit!
    await prisma.$transaction(async (tx) => {
      // 1. Mark TrxID as CLAIMED — conditional on it still being UNCLAIMED.
      //    Two concurrent claims of the same TrxID would both pass the pre-check
      //    above; this guarded write lets only the first transaction match a row
      //    (count === 1). The loser matches zero rows, throws, and rolls back, so
      //    the wallet is credited exactly once even under a race / double-submit.
      const claimed = await tx.bkashLedger.updateMany({
        where: { id: bkashRecord.id, status: "UNCLAIMED" },
        data: {
          status: "CLAIMED",
          claimedById: student.id
        }
      });
      if (claimed.count === 0) {
        throw new Error("ALREADY_CLAIMED");
      }

      // 2. Add to student wallet
      await tx.wallet.upsert({
        where: { studentId: student.id },
        update: { balance: { increment: bkashRecord.amount } },
        create: { studentId: student.id, balance: bkashRecord.amount }
      });

      // 3. Log transaction
      await tx.transaction.create({
        data: {
          studentId: student.id,
          type: "DEPOSIT",
          amount: bkashRecord.amount,
          description: `bKash Auto-Verification (TrxID: ${trxId})`
        }
      });
      
      // 4. Also create a DepositApproval record and mark it auto-approved for history
      await tx.depositApproval.create({
        data: {
          studentId: student.id,
          amount: bkashRecord.amount,
          status: "APPROVED",
          receipt: `bKash Auto-Verification (TrxID: ${trxId})`,
        }
      });
      
      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          studentId: student.id,
          action: "BKASH_AUTO_VERIFY",
          details: `Verified Tk ${bkashRecord.amount} with TrxID ${trxId}`
        }
      });
    });

    // Trigger google sheets live sync in background
    triggerLiveSheetSync();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully verified and added Tk ${bkashRecord.amount} to your wallet!` 
    });

  } catch (error: any) {
    if (error?.message === "ALREADY_CLAIMED") {
      return NextResponse.json(
        { error: "This TrxID has already been claimed." },
        { status: 400 }
      );
    }
    console.error("Verify bKash error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
