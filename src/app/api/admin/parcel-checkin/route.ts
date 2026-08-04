import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isStudentAutoOff, getStudentPeriodDeposit } from "@/lib/meal-utils"

// A custom webhook caller just for appending logs to the Google Sheet
async function triggerGoogleSheetAppend(logData: any) {
  const syncUrl = process.env.GOOGLE_SCRIPT_SCAN_LOG_URL;
  if (!syncUrl) return;

  try {
    await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "appendScanLog",
        data: logData
      }),
    });
  } catch (error) {
    console.error("Live sheet append error", error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const girls = await prisma.student.findMany({
      where: { gender: "FEMALE", isActive: true },
      select: { id: true, name: true, diningId: true, department: true, session: true },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({ students: girls })
  } catch (error) {
    console.error("Parcel check-in GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { studentIds } = await req.json()
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "No students selected" }, { status: 400 })
    }

    // Check current meal time
    const bdtString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
    const bdtDate = new Date(bdtString)
    const hour = bdtDate.getHours()
    const minute = bdtDate.getMinutes()

    const year = bdtDate.getFullYear()
    const month = String(bdtDate.getMonth() + 1).padStart(2, '0')
    const day = String(bdtDate.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    let currentMeal: "lunch" | "dinner" | null = null
    if (hour >= 10 && hour < 17) {
      currentMeal = "lunch"
    } else if (hour >= 19 && (hour < 23 || (hour === 23 && minute <= 30))) {
      currentMeal = "dinner"
    }

    if (!currentMeal) {
      return NextResponse.json({ error: "No active meal service at this time. Lunch is 10AM-5PM, Dinner is 7PM-11:30PM." }, { status: 400 })
    }

    const activePeriod = await prisma.diningPeriod.findFirst({ where: { isActive: true } })

    const results: { studentId: string; name: string; diningId: string | null; status: "success" | "error"; message: string }[] = []

    for (const sid of studentIds) {
      const student = await prisma.student.findUnique({
        where: { id: sid },
        include: { wallet: true }
      })

      if (!student) {
        results.push({ studentId: sid, name: "Unknown", diningId: null, status: "error", message: "Student not found" })
        continue
      }

      if (!student.isActive) {
        results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "error", message: "Account inactive" })
        continue
      }

      // Check auto-off
      if (activePeriod) {
        const periodDeposit = await getStudentPeriodDeposit(student.id, activePeriod)
        const balance = student.wallet?.balance || 0
        const { autoOff, reason } = isStudentAutoOff(balance, activePeriod, bdtDate, periodDeposit)

        const schedules = await prisma.mealSchedule.findMany({ where: { studentId: student.id } })
        const schedule = schedules.find(s => s.date.toISOString().split("T")[0] === todayStr)
        const isSuspended = autoOff && !(schedule && schedule.adminOverride)

        if (isSuspended) {
          results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "error", message: `Auto-off: ${reason}` })
          await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal.toUpperCase(), status: "AUTO-OFF", reason });
          continue
        }

        // Check meal schedule
        if (schedule) {
          if (currentMeal === "lunch" && !schedule.lunch) {
            results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "error", message: "Lunch turned OFF" })
            await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal.toUpperCase(), status: "FAILED", reason: "Lunch turned OFF" });
            continue
          }
          if (currentMeal === "dinner" && !schedule.dinner) {
            results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "error", message: "Dinner turned OFF" })
            await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal.toUpperCase(), status: "FAILED", reason: "Dinner turned OFF" });
            continue
          }
        }
      }

      // Prevent double scan
      const actionKey = `MEAL_SCANNED_${currentMeal.toUpperCase()}_${todayStr}`
      const existingScan = await prisma.auditLog.findFirst({
        where: { studentId: student.id, action: actionKey }
      })

      if (existingScan) {
        const scanTime = new Date(existingScan.createdAt).toLocaleTimeString("en-US", {
          timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hour12: true
        })
        results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "error", message: `Already checked in at ${scanTime}` })
        await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal.toUpperCase(), status: "DOUBLE SCAN", reason: `Previously checked in at ${scanTime}` });
        continue
      }

      // Record check-in
      await prisma.auditLog.create({
        data: {
          studentId: student.id,
          action: actionKey,
          details: `Parcel delivery check-in for ${currentMeal}`
        }
      })

      results.push({ studentId: sid, name: student.name, diningId: student.diningId, status: "success", message: `${currentMeal} parcel checked in` })
      await triggerGoogleSheetAppend({ time: bdtString, name: student.name, diningId: student.diningId, department: student.department, meal: currentMeal.toUpperCase(), status: "SUCCESS", reason: `Parcel check-in for ${currentMeal}` });
    }

    const successCount = results.filter(r => r.status === "success").length
    const errorCount = results.filter(r => r.status === "error").length

    return NextResponse.json({
      message: `${successCount} checked in, ${errorCount} failed`,
      meal: currentMeal,
      results
    })

  } catch (error) {
    console.error("Parcel check-in POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
