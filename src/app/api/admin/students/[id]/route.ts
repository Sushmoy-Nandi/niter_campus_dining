import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCurrentMealRates, calculateDynamicMealRate, isStudentAutoOff, getStudentPeriodDeposit, toUTCDateKey, periodEndInclusive } from "@/lib/meal-utils"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const existingStudent = await prisma.student.findFirst({ where: { OR: [{ id }, { studentId: id }] } });
    if (!existingStudent) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const student = await prisma.student.update({
      where: { id: existingStudent.id },
      data: {
        name: body.name,
        email: body.email,
        department: body.department,
        session: body.session,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({ student })
  } catch (error) {
    console.error("Update student error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const student = await prisma.student.findFirst({
      where: { OR: [{ id }, { studentId: id }] },
      select: { userId: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Deleting the User will CASCADE and delete the Student, Wallet, Transactions, 
    // MealSchedules, DailyCharges, and AuditLogs automatically because of the Prisma schema configuration.
    await prisma.user.delete({
      where: { id: student.userId },
    })

    return NextResponse.json({ message: "Student completely deleted" })
  } catch (error) {
    console.error("Delete student error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const periodId = searchParams.get("periodId")

    const activePeriod = await prisma.diningPeriod.findFirst({
      where: { isActive: true },
    })

    let dateFilter = undefined
    if (activePeriod) {
      const pEnd = new Date(activePeriod.endDate)
      pEnd.setUTCHours(23, 59, 59, 999)
      
      dateFilter = {
        gte: activePeriod.startDate,
        lte: pEnd,
      }
    }

    const student = await prisma.student.findFirst({
      where: { OR: [{ id }, { studentId: id }] },
      include: {
        wallet: true,
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        mealSchedules: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
        dailyCharges: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const rates = await getCurrentMealRates()
    const lunchRate = rates.lunchPrice
    const dinnerRate = rates.dinnerPrice

    // Set of dates already charged
    const chargedDates = new Set(student.dailyCharges.map((dc: any) => new Date(dc.date).toDateString()))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const balance = student.wallet?.balance || 0
    let projectedSpending = 0
    let dynamicMealRate = 0

    if (activePeriod && student.isActive) {
      const pStart = new Date(activePeriod.startDate)
      const pEnd = periodEndInclusive(activePeriod.endDate)

      // 1. Dynamic meal rate for the whole period (shared helper — same basis
      //    as the student dashboard so the numbers agree across views)
      const { mealRate } = await calculateDynamicMealRate(pStart, pEnd)
      dynamicMealRate = mealRate

      // 2. This student's total meals for the ENTIRE period (Past + Future).
      //    Key by UTC calendar day (storage is UTC-midnight) so counts never
      //    drift with the server timezone.
      const scheduleMap = new Map()
      student.mealSchedules.forEach((meal: any) => {
        scheduleMap.set(toUTCDateKey(meal.date), meal)
      })

      // Fetch period deposit for auto-off logic
      const periodDeposit = await getStudentPeriodDeposit(student.id, activePeriod);

      let studentTotalMeals = 0
      const d = new Date(pStart)

      while (d <= pEnd) {
        const { autoOff: dayAutoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);
        if (!dayAutoOff) {
          const s = scheduleMap.get(toUTCDateKey(d))
          if (s) {
            if (s.lunch) studentTotalMeals += 1
            if (s.dinner) studentTotalMeals += 1
          } else {
            studentTotalMeals += 2 // Default ON
          }
        }
        d.setUTCDate(d.getUTCDate() + 1)
      }

      // Total estimated cost for the month
      projectedSpending = studentTotalMeals * dynamicMealRate

    } else {
      // Fallback if no active period
      student.mealSchedules.forEach((meal: any) => {
        if (meal.lunch) projectedSpending += lunchRate
        if (meal.dinner) projectedSpending += dinnerRate
      })
    }

    const remainingBalance = balance - projectedSpending

    // Generate full timeline for UI
    let fullSchedules = student.mealSchedules
    if (activePeriod) {
      const allSchedules = []
      const schedMap = new Map()
      student.mealSchedules.forEach((m: any) => schedMap.set(toUTCDateKey(m.date), m))

      const tempD = new Date(activePeriod.startDate)
      const tempEnd = periodEndInclusive(activePeriod.endDate)
      const periodDeposit = await getStudentPeriodDeposit(student.id, activePeriod)

      while (tempD <= tempEnd) {
        const ds = toUTCDateKey(tempD)
        const { autoOff } = isStudentAutoOff(balance, activePeriod, tempD, periodDeposit)
        
        if (schedMap.has(ds)) {
          const s = schedMap.get(ds)
          const isSuspended = autoOff && !s.adminOverride
          allSchedules.push({
            ...s,
            lunch: isSuspended ? false : s.lunch,
            dinner: isSuspended ? false : s.dinner,
            isSuspended
          })
        } else {
          allSchedules.push({
            id: `default-${ds}`,
            date: tempD.toISOString(),
            lunch: autoOff ? false : true,
            dinner: autoOff ? false : true,
            isDefault: true,
            isSuspended: autoOff
          })
        }
        tempD.setUTCDate(tempD.getUTCDate() + 1)
      }
      allSchedules.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      fullSchedules = allSchedules
    }

    return NextResponse.json({ 
      student: { ...student, mealSchedules: fullSchedules }, 
      projectedSpending, 
      remainingBalance,
      currentRates: { lunch: lunchRate, dinner: dinnerRate }
    })
  } catch (error) {
    console.error("Fetch student details error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
