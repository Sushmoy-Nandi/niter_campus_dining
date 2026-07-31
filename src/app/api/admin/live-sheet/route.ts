import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff, calculateDynamicMealRate, toUTCDateKey, periodEndInclusive } from "@/lib/meal-utils"
import { getMasterSheetSecret } from "@/lib/secrets"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  
  const expectedSecret = getMasterSheetSecret()
  if (!secret || secret !== expectedSecret) {
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
  const periodEnd = periodEndInclusive(activePeriod.endDate)

  const allSchedules = await prisma.mealSchedule.findMany({
    where: { date: { gte: periodStart, lte: periodEnd } },
  })

  // Group schedules by date and student
  const scheduleMap = new Map<string, Map<string, any>>();
  allSchedules.forEach(s => {
    const dStr = toUTCDateKey(s.date);
    if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
    scheduleMap.get(dStr)!.set(s.studentId, s);
  });

  const daysList: Date[] = []
  for (let d = new Date(periodStart); d <= periodEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    daysList.push(new Date(d))
  }

  let csvRows = []

  // Headers
  let headerRow = ["SL", "Name", "Department", "Dining ID", "Total Deposit", "Cost", "On-Hand Balance", "Total Meals"]
  daysList.forEach(d => {
    const dayNum = d.getUTCDate()
    headerRow.push(`${dayNum}-L`)
    headerRow.push(`${dayNum}-D`)
  })
  csvRows.push(headerRow.join(","))

  let sl = 1
  let grandTotalMeals = 0;
  let dailyTotals = new Array(daysList.length * 2).fill(0);
  for (const student of students) {
    const balance = student.wallet?.balance || 0;
    const periodDeposit = periodDepositMap.get(student.id) || 0;
    
    let totalMeals = 0;
    let dailyRow = [];

    // Calculate daily meals
    for (let i = 0; i < daysList.length; i++) {
      const d = daysList[i];
      const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);
      if (autoOff) {
        dailyRow.push("0")
        dailyRow.push("0")
      } else {
        const dStr = toUTCDateKey(d);
        const s = scheduleMap.get(dStr)?.get(student.id);
        
        let l = 1, din = 1;
        if (s) {
          l = s.lunch ? 1 : 0
          din = s.dinner ? 1 : 0
        }
        
        dailyRow.push(l.toString())
        dailyRow.push(din.toString())
        
        totalMeals += l + din
        dailyTotals[i*2] += l
        dailyTotals[i*2+1] += din
      }
    }

    const cost = totalMeals * mealRate;
    // On-Hand is the live projection: deposits still held minus the running meal cost.
    // (balance holds the total deposit during an active period; cost is transient until
    // settlement permanently deducts it.)
    const onHand = balance - cost;

    const row = [
      sl++,
      `"${student.name}"`,
      `"${student.department || ""}"`,
      `"${student.diningId || ""}"`,
      balance.toFixed(2),
      cost.toFixed(2),
      onHand.toFixed(2),
      totalMeals
    ]
    
    grandTotalMeals += totalMeals;
    csvRows.push([...row, ...dailyRow].join(","))
  }

  // Add Total Meals Row
  const totalRow = ["", "", "", "", "", "", "TOTAL MEALS", grandTotalMeals]
  csvRows.push([...totalRow, ...dailyTotals.map(n => n.toString())].join(","))

  // Fetch Bazaar and Add Daily Bazaar Cost Row
  const bazaars = await prisma.bazaar.findMany({
    where: { date: { gte: periodStart, lte: periodEnd } }
  })
  
  const bazaarMap = new Map<string, number>();
  bazaars.forEach(b => {
    const dStr = toUTCDateKey(b.date);
    bazaarMap.set(dStr, (bazaarMap.get(dStr) || 0) + b.amount);
  })

  let totalBazaarCostSum = 0;
  let dailyBazaarRow = [];
  
  for (let i = 0; i < daysList.length; i++) {
    const dStr = toUTCDateKey(daysList[i]);
    const cost = bazaarMap.get(dStr) || 0;
    totalBazaarCostSum += cost;
    dailyBazaarRow.push(cost.toString()) // Put cost under Lunch column
    dailyBazaarRow.push("")              // Leave Dinner column blank
  }

  const bazaarRow = ["", "", "", "", "", "", "DAILY BAZAAR COST", totalBazaarCostSum.toFixed(2)]
  csvRows.push([...bazaarRow, ...dailyBazaarRow].join(","))

  const csvContent = csvRows.join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campus_dining_live_sheet_${activePeriod.title}.csv"`,
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
  })
}
