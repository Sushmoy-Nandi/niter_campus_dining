import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    
    const bdtString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
    const bdtDate = new Date(bdtString);
    const year = bdtDate.getFullYear();
    const month = String(bdtDate.getMonth() + 1).padStart(2, '0');
    const day = String(bdtDate.getDate()).padStart(2, '0');
    const defaultToday = `${year}-${month}-${day}`;

    const startDateStr = startDateParam || defaultToday;
    const endDateStr = endDateParam || startDateStr;

    // Set up start and end of day in BDT for querying createdAt
    const startOfDay = new Date(startDateStr + "T00:00:00.000+06:00")
    const endOfDay = new Date(endDateStr + "T23:59:59.999+06:00")

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { startsWith: "MEAL_SCANNED_" } },
          { action: { startsWith: "FAILED_SCAN_" } }
        ],
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        student: { select: { name: true, diningId: true, studentId: true, department: true } }
      }
    })

    const checkIns = await prisma.mealCheckIn.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        student: { select: { name: true, diningId: true, studentId: true, department: true } }
      }
    })

    const mappedCheckIns = checkIns.map(c => ({
      id: c.id,
      action: c.status === "AUTHORIZED" ? `MEAL_SCANNED_${c.mealType}` : `FAILED_SCAN_QR_${c.mealType}`,
      details: c.reason || "QR Code Scan",
      createdAt: c.createdAt,
      student: c.student
    }))

    const logs = [...auditLogs, ...mappedCheckIns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Group logs for easy stats
    let totalScanned = 0
    let totalFailed = 0
    let doubleScans = 0
    let autoOffFails = 0
    
    // We should also get the total scheduled for today
    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true }
    })
    
    let totalScheduledLunch = 0;
    let totalScheduledDinner = 0;
    
    if (activePeriod) {
      // Find all active students and their schedules for today
      const students = await prisma.student.findMany({ where: { isActive: true }, include: { wallet: true } });
      const targetDate = new Date(startDateStr);
      
      const schedules = await prisma.mealSchedule.findMany({
        where: { date: targetDate }
      });
      
      const scheduleMap = new Map();
      schedules.forEach(s => scheduleMap.set(s.studentId, s));
      
      // We would ideally need to check autoOff for all of them to get accurate scheduled,
      // but for a fast view, we can just look at raw schedules vs defaults.
      // We will do a rough count for UI stats.
    }

    logs.forEach(log => {
      if (log.action.startsWith("MEAL_SCANNED_")) {
        totalScanned++
      } else if (log.action.startsWith("FAILED_SCAN_")) {
        totalFailed++
        if (log.details?.includes("Double scan")) doubleScans++
        if (log.details?.includes("auto-disabled") || log.action === "FAILED_SCAN_AUTO_OFF") autoOffFails++
      }
    })

    return NextResponse.json({
      startDate: startDateStr,
      endDate: endDateStr,
      stats: {
        totalScanned,
        totalFailed,
        doubleScans,
        autoOffFails
      },
      logs
    })

  } catch (error) {
    console.error("Scan logs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
