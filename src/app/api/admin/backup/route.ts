import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all vital tables
    const students = await prisma.student.findMany({ include: { wallet: true } });
    const admins = await prisma.admin.findMany();
    const periods = await prisma.diningPeriod.findMany();
    const meals = await prisma.mealSchedule.findMany();
    const transactions = await prisma.transaction.findMany();
    const bazaars = await prisma.bazaar.findMany({ include: { items: true } });
    const polls = await prisma.poll.findMany({ include: { options: true, votes: true } });
    const feedback = await prisma.mealFeedback.findMany();

    const backupData = {
      timestamp: new Date().toISOString(),
      data: {
        students,
        admins,
        periods,
        meals,
        transactions,
        bazaars,
        polls,
        feedback
      }
    };

    // Return as a downloadable JSON file
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="campus_dining_backup_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    console.error("Backup failed", error);
    return NextResponse.json({ error: "Failed to generate backup" }, { status: 500 });
  }
}
