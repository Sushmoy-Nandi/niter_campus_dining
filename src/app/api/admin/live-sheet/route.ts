import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff, calculateDynamicMealRate } from "@/lib/meal-utils"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  
  const expectedSecret = process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET || "NITER_MASTER_2026"
  if (secret !== expectedSecret) {
    return new NextResponse("Unauthorized. Invalid secret key.", { status: 401 })
  }

  const activePeriod = await prisma.diningPeriod.findFirst({
    where: { isActive: true }
  })
  
  if (!activePeriod) {
    return new NextResponse("No active period found", { status: 400 })
  }

  const students = await prisma.student.findMany({
    where: { isActive: true },
    include: { wallet: true },
    orderBy: { diningId: 'asc' }
  })

  const periodDepositMap = await getStudentPeriodDeposits(activePeriod)
  const { mealRate } = await calculateDynamicMealRate(activePeriod.startDate, activePeriod.endDate)

  const periodStart = new Date(activePeriod.startDate)
  const periodEnd = new Date(activePeriod.endDate)
  periodEnd.setUTCHours(23, 59, 59, 999)

  const allSchedules = await prisma.mealSchedule.findMany({
    where: { date: { gte: periodStart, lte: periodEnd } },
  })

  // Group schedules by date and student
  const scheduleMap = new Map<string, Map<string, any>>();
  allSchedules.forEach(s => {
    const dStr = new Date(s.date).toISOString().split('T')[0];
    if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
    scheduleMap.get(dStr)!.set(s.studentId, s);
  });

  const daysList: Date[] = []
  for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
    daysList.push(new Date(d))
  }

  let csvRows = []
  
  // Headers
  let headerRow = ["SL", "Name", "Department", "Dining ID", "Total Deposit", "Cost", "On-Hand Balance", "Total Meals"]
  daysList.forEach(d => {
    const dayNum = d.getDate()
    headerRow.push(`${dayNum}-L`)
    headerRow.push(`${dayNum}-D`)
  })
  csvRows.push(headerRow.join(","))

  let sl = 1
  for (const student of students) {
    const balance = student.wallet?.balance || 0;
    const periodDeposit = periodDepositMap.get(student.id) || 0;
    
    let totalMeals = 0;
    let dailyRow = [];

    // Calculate daily meals
    for (const d of daysList) {
      const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);
      if (autoOff) {
        dailyRow.push("0")
        dailyRow.push("0")
      } else {
        const dStr = d.toISOString().split('T')[0];
        const s = scheduleMap.get(dStr)?.get(student.id);
        
        let l = 1, din = 1;
        if (s) {
          l = s.lunch ? 1 : 0
          din = s.dinner ? 1 : 0
        }
        
        dailyRow.push(l.toString())
        dailyRow.push(din.toString())
        
        totalMeals += l + din
      }
    }

    const cost = totalMeals * mealRate;

    const row = [
      sl++,
      `"${student.name}"`,
      `"${student.department || ""}"`,
      `"${student.diningId || ""}"`,
      periodDeposit.toFixed(2),
      cost.toFixed(2),
      balance.toFixed(2),
      totalMeals
    ]
    
    csvRows.push([...row, ...dailyRow].join(","))
  }

  const csvContent = csvRows.join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campus_dining_live_sheet_${activePeriod.title}.csv"`,
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
  })
}
