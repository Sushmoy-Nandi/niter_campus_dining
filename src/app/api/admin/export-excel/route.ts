import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff, calculateDynamicMealRate, toUTCDateKey, periodEndInclusive } from "@/lib/meal-utils"
import ExcelJS from "exceljs"
import { auth } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("secret")

    // Optional secret check if they want to access it outside the app
    const expectedSecret = process.env.MASTER_SHEET_SECRET || process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET

    // Authenticate either via admin session or valid secret key
    const session = await auth()
    const isAdmin = session?.user?.role === 'ADMIN'

    if (!isAdmin && (!expectedSecret || !secret || secret !== expectedSecret)) {
      return new NextResponse("Unauthorized. Invalid secret key or session.", { status: 401 })
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

    const periodStart = new Date(activePeriod.startDate)
    const periodEnd = periodEndInclusive(activePeriod.endDate)

    const allSchedules = await prisma.mealSchedule.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } },
    })

    const scheduleMap = new Map<string, Map<string, any>>();
    allSchedules.forEach(s => {
      const dStr = toUTCDateKey(s.date);
      if (!scheduleMap.has(dStr)) scheduleMap.set(dStr, new Map());
      scheduleMap.get(dStr)!.set(s.studentId, s);
    });

    // Build the inclusive day list by stepping in UTC. This is the single source of
    // truth for how many day-columns the sheet has — everything downstream (widths,
    // headers, per-student cells, totals, bazaar block position) is derived from its
    // length, so 28-, 30-, 31- or 35-day periods all export correctly with no dropped days.
    const daysList: Date[] = []
    for (let d = new Date(periodStart); d <= periodEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      daysList.push(new Date(d))
    }
    const numDays = daysList.length

    // --- DYNAMIC COLUMN LAYOUT (all 1-indexed) ---
    const DAY_START_COL = 16 // Column P — first daily Lunch cell
    const dayEndCol = DAY_START_COL + numDays * 2 - 1 // last daily Dinner cell
    const totalMealsCol = dayEndCol + 1
    const bazaarSepCol = totalMealsCol + 1
    const bazaarDateCol = totalMealsCol + 2
    const bazaarNameCol = bazaarDateCol + 1
    const bazaarDetailsCol = bazaarDateCol + 2
    const bazaarCostCol = bazaarDateCol + 3

    const bazaars = await prisma.bazaar.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } }
    })

    const { mealRate } = await calculateDynamicMealRate(activePeriod.startDate, activePeriod.endDate);

    // Create Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Campus Dining System';

    const sheet = workbook.addWorksheet(activePeriod.title, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }]
    });

    // Column number → letter (e.g. 16 → "P", 86 → "CH"). Works for any column count.
    const colLetter = (n: number) => sheet.getColumn(n).letter

    const borderStyle: any = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    const fontNormal = { name: 'Times New Roman', size: 10 };
    const fontBold = { name: 'Times New Roman', size: 10, bold: true };
    const alignCenter: any = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const colorA_G = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } } as any;
    const colorI_K = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D2E9' } } as any;
    const colorO_CF = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9FC5E8' } } as any;
    const colorTotalMeals = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6AA84F' } } as any;
    const colorDep1 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } } as any; // Pastel Yellow
    const colorDep2 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9CB9C' } } as any; // Pastel Orange
    const colorDep3 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB6D7A8' } } as any; // Pastel Green

    // Col widths
    sheet.getColumn('A').width = 12; // ID
    sheet.getColumn('B').width = 19.25; // Name
    sheet.getColumn('C').width = 10.75;
    sheet.getColumn('D').width = 10.5;
    sheet.getColumn('E').width = 11.13;
    sheet.getColumn('F').width = 12.0;
    sheet.getColumn('G').width = 4.75; // Sep
    sheet.getColumn('H').width = 10.75;
    sheet.getColumn('I').width = 11.25;
    sheet.getColumn('J').width = 11.25;
    sheet.getColumn('K').width = 4.75; // Sep
    sheet.getColumn('L').width = 16.88; // Stats
    sheet.getColumn('M').width = 4.75; // Sep
    sheet.getColumn('N').width = 12; // ID
    sheet.getColumn('O').width = 19.25; // Name

    let cIndex = DAY_START_COL;
    for (let i = 0; i < numDays; i++) {
      sheet.getColumn(cIndex).width = 4.5;
      sheet.getColumn(cIndex + 1).width = 4.5;
      cIndex += 2;
    }

    sheet.getColumn(totalMealsCol).width = 8.88;
    sheet.getColumn(bazaarSepCol).width = 4.75;
    sheet.getColumn(bazaarDateCol).width = 17.88;
    sheet.getColumn(bazaarNameCol).width = 24.13;
    sheet.getColumn(bazaarDetailsCol).width = 44;
    sheet.getColumn(bazaarCostCol).width = 15.25;

    // Headers
    const r1 = sheet.getRow(1);
    const r2 = sheet.getRow(2);
    r1.height = 30;
    r2.height = 15;

    const setHeader = (col: string, val1: any, val2: any, color: any, merge = true) => {
      const c1 = r1.getCell(col);
      c1.value = val1;
      c1.font = fontBold;
      c1.fill = color;
      c1.alignment = alignCenter;
      c1.border = borderStyle;

      if (merge) {
        sheet.mergeCells(`${col}1:${col}2`);
      } else {
        const c2 = r2.getCell(col);
        c2.value = val2;
        c2.font = fontBold;
        c2.fill = color;
        c2.alignment = alignCenter;
        c2.border = borderStyle;
      }
    };

    setHeader('A', 'ID', '', colorA_G);
    setHeader('B', 'Name', '', colorA_G);

    const lastRow = students.length + 2; // e.g. 302 if 300 students
    const totalRowIdx = lastRow + 1; // e.g. 303

    setHeader('C', { formula: `="Deposite 1 "&CHAR(10)&SUM(C${totalRowIdx}+0)` }, '', colorDep1);
    setHeader('D', { formula: `="Deposite 2 "&CHAR(10)&SUM(D${totalRowIdx}+0)` }, '', colorDep2);
    setHeader('E', { formula: `="Deposite 3 "&CHAR(10)&SUM(E${totalRowIdx}+0)` }, '', colorDep3);
    setHeader('F', { formula: `="Total Deposite "&CHAR(10)&SUM(F${totalRowIdx}+0)` }, '', colorA_G);

    setHeader('H', 'Deposite', '', colorI_K);
    setHeader('I', 'Cost', '', colorI_K);
    setHeader('J', 'On-Hand', '', colorI_K);

    const m1 = r1.getCell('L');
    m1.border = borderStyle;
    const m2 = r2.getCell('L');
    m2.border = borderStyle;

    setHeader('N', 'ID', '', colorO_CF);
    setHeader('O', 'Name', '', colorO_CF);

    let dateCol = DAY_START_COL; // P
    for (let i = 0; i < numDays; i++) {
      const c1 = r1.getCell(dateCol);
      c1.value = new Date(daysList[i]);
      c1.numFmt = 'd-MMM';
      c1.font = fontBold;
      c1.fill = colorO_CF;
      c1.alignment = alignCenter;
      c1.border = borderStyle;

      const c1b = r1.getCell(dateCol + 1);
      c1b.border = borderStyle;

      sheet.mergeCells(1, dateCol, 1, dateCol + 1);

      const c2a = r2.getCell(dateCol);
      c2a.value = 'L';
      c2a.font = fontNormal;
      c2a.fill = colorO_CF;
      c2a.alignment = alignCenter;
      c2a.border = borderStyle;

      const c2b = r2.getCell(dateCol + 1);
      c2b.value = 'D';
      c2b.font = fontNormal;
      c2b.fill = colorO_CF;
      c2b.alignment = alignCenter;
      c2b.border = borderStyle;

      dateCol += 2;
    }

    setHeader(colLetter(totalMealsCol), 'Total Meals', '', colorO_CF);
    setHeader(colLetter(bazaarDateCol), 'Date', '', colorO_CF);
    setHeader(colLetter(bazaarNameCol), 'Name', '', colorO_CF);
    setHeader(colLetter(bazaarDetailsCol), 'Bazer Details', '', colorO_CF);
    setHeader(colLetter(bazaarCostCol), 'Cost', '', colorO_CF);

    const totalMealsLetter = colLetter(totalMealsCol)
    const bazaarCostLetter = colLetter(bazaarCostCol)

    // Stats block (Column L). Meal Rate = Total Cost / Total Meal Count, guarded by IFERROR.
    sheet.getCell('L3').value = 'Current Meal Rate';
    sheet.getCell('L3').font = fontBold;
    sheet.getCell('L4').value = { formula: 'IFERROR(L11/L7, 0)' };
    sheet.getCell('L4').font = { ...fontBold, size: 12, color: { argb: 'FFFF0000' } }; // Make it pop just in case
    sheet.getCell('L4').alignment = alignCenter;

    // N block formatting
    ['L3', 'L4', 'L6', 'L7', 'L10', 'L11', 'L13', 'L14'].forEach(cellRef => {
        sheet.getCell(cellRef).border = borderStyle;
        sheet.getCell(cellRef).alignment = alignCenter;
    });

    sheet.getCell('L6').value = 'Total Meal Count';
    sheet.getCell('L6').font = fontBold;
    sheet.getCell(`L7`).value = { formula: `SUM(${totalMealsLetter}3:${totalMealsLetter}${lastRow})` };
    sheet.getCell(`L7`).numFmt = '0';

    sheet.getCell('L10').value = 'Total Cost';
    sheet.getCell('L10').font = fontBold;
    sheet.getCell(`L11`).value = { formula: `SUM(${bazaarCostLetter}3:${bazaarCostLetter}${lastRow})` };
    sheet.getCell(`L11`).numFmt = '0.00';

    sheet.getCell('L13').value = 'On-Hand';
    sheet.getCell('L13').font = fontBold;
    sheet.getCell(`L14`).value = { formula: `SUM(J3:J${lastRow})` };
    sheet.getCell(`L14`).numFmt = '0.00';

    // Students Data
    let r = 3;
    let sl = 1;
    for (const student of students) {
      const row = sheet.getRow(r);
      const applyCell = (cStr: string, val: any, format=null) => {
        const cell = sheet.getCell(`${cStr}${r}`);
        cell.value = val;
        cell.font = fontNormal;
        cell.alignment = alignCenter;
        cell.border = borderStyle;
        if (format) cell.numFmt = format as any;
      };

      const balance = student.wallet?.balance || 0;
      const periodDepositTx = periodDepositMap.get(student.id) || 0;

      let mc = DAY_START_COL;
      let dailyVals: any[] = [];

      for (let i = 0; i < numDays; i++) {
        let lVal: number | string = '';
        let dVal: number | string = '';

        const d = daysList[i];
        const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDepositTx);
        if (autoOff) {
          lVal = 0; dVal = 0;
        } else {
          const dStr = toUTCDateKey(d);
          const s = scheduleMap.get(dStr)?.get(student.id);
          lVal = s ? (s.lunch ? 1 : 0) : 1;
          dVal = s ? (s.dinner ? 1 : 0) : 1;
        }
        dailyVals.push({ lVal, dVal });
      }

      const dayStartLetter = colLetter(DAY_START_COL)
      const dayEndLetter = colLetter(dayEndCol)

      applyCell('A', student.diningId);
      applyCell('B', student.name);
      applyCell('C', balance); // Deposite 1 (wallet balance already includes all period deposits + rollover)
      applyCell('D', 0); // Deposite 2
      applyCell('E', 0); // Deposite 3
      applyCell('F', { formula: `SUM(C${r}:E${r})` });

      applyCell('H', { formula: `SUM(F${r}+0)` });
      applyCell('I', { formula: `${totalMealsLetter}${r}*$L$4` }); // Calculates live cost = meals × rate
      applyCell('J', { formula: `H${r}-I${r}` }); // Calculates live On-Hand = deposit − cost

      applyCell('N', student.diningId);
      applyCell('O', student.name);

      for (let i = 0; i < numDays; i++) {
        const { lVal, dVal } = dailyVals[i];
        const cellL = row.getCell(mc);
        cellL.value = lVal;
        cellL.font = fontNormal; cellL.alignment = alignCenter; cellL.border = borderStyle;

        const cellD = row.getCell(mc + 1);
        cellD.value = dVal;
        cellD.font = fontNormal; cellD.alignment = alignCenter; cellD.border = borderStyle;

        mc += 2;
      }

      const cellTM = sheet.getCell(`${totalMealsLetter}${r}`);
      cellTM.value = { formula: `SUM(${dayStartLetter}${r}:${dayEndLetter}${r})` };
      cellTM.font = fontNormal;
      cellTM.fill = colorTotalMeals;
      cellTM.alignment = alignCenter;
      cellTM.border = borderStyle;
      cellTM.numFmt = '0';

      r++;
      sl++;
    }

    // Totals Row
    const applyTotal = (cStr: string, formulaStr: string) => {
      const cell = sheet.getCell(`${cStr}${totalRowIdx}`);
      cell.value = { formula: formulaStr };
      cell.font = fontBold;
      cell.alignment = alignCenter;
      cell.border = borderStyle;
    };

    applyTotal('C', `SUM(C3:C${lastRow})`);
    applyTotal('D', `SUM(D3:D${lastRow})`);
    applyTotal('E', `SUM(E3:E${lastRow})`);
    applyTotal('F', `SUM(F3:F${lastRow})`);

    // Sum every daily column (2 per day) dynamically.
    for (let c = DAY_START_COL; c <= dayEndCol; c++) {
      const cl = colLetter(c);
      applyTotal(cl, `SUM(${cl}3:${cl}${lastRow})`);
    }

    const dayStartLetter = colLetter(DAY_START_COL)
    const dayEndLetter = colLetter(dayEndCol)
    applyTotal(totalMealsLetter, `SUM(${dayStartLetter}${totalRowIdx}:${dayEndLetter}${totalRowIdx})`);
    sheet.getCell(`${totalMealsLetter}${totalRowIdx}`).fill = colorTotalMeals;
    applyTotal(bazaarCostLetter, `SUM(${bazaarCostLetter}3:${bazaarCostLetter}${lastRow})`);

    // Fill Bazaar actual data
    let bRow = 3;
    for (const b of bazaars) {
      if (bRow > lastRow) break; // If we exceed student rows, just stop for safety
      sheet.getCell(`${colLetter(bazaarDateCol)}${bRow}`).value = new Date(b.date);
      sheet.getCell(`${colLetter(bazaarDateCol)}${bRow}`).numFmt = 'dd-mm-yyyy';
      sheet.getCell(`${colLetter(bazaarNameCol)}${bRow}`).value = b.name || 'Bazaar';
      sheet.getCell(`${colLetter(bazaarDetailsCol)}${bRow}`).value = b.details || '';
      sheet.getCell(`${colLetter(bazaarCostCol)}${bRow}`).value = b.amount;
      bRow++;
    }

    // Create a buffer and send
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Campus_Dining_Master_${activePeriod.title.replace(/\s+/g, '_')}.xlsx"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error("Export Excel Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
