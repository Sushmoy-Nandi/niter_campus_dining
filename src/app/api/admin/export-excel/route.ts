import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getStudentPeriodDeposits, isStudentAutoOff } from "@/lib/meal-utils"
import ExcelJS from "exceljs"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("secret")
    
    // Optional secret check if they want to access it outside the app
    const expectedSecret = process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET || "NITER_MASTER_2026"
    if (secret && secret !== expectedSecret) {
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
    
    const periodStart = new Date(activePeriod.startDate)
    const periodEnd = new Date(activePeriod.endDate)
    periodEnd.setUTCHours(23, 59, 59, 999)

    const allSchedules = await prisma.mealSchedule.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } },
    })

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

    const bazaars = await prisma.bazaar.findMany({
      where: { date: { gte: periodStart, lte: periodEnd } }
    })

    // Create Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Campus Dining System';
    
    const sheet = workbook.addWorksheet(activePeriod.title, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }]
    });

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

    let cIndex = 16; // Q
    for (let i = 0; i < 31; i++) {
      sheet.getColumn(cIndex).width = 4.5;
      sheet.getColumn(cIndex+1).width = 4.5;
      cIndex += 2;
    }
    
        sheet.getColumn('BZ').width = 8.88;
    sheet.getColumn('CA').width = 4.75;
    sheet.getColumn('CB').width = 17.88;
    sheet.getColumn('CC').width = 24.13;
    sheet.getColumn('CD').width = 44;
    sheet.getColumn('CE').width = 15.25;

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

    let currentDate = new Date(periodStart);
    let dateCol = 19; // S // Q
    for (let i = 0; i < 31; i++) {
      const c1 = r1.getCell(dateCol);
      c1.value = new Date(currentDate);
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

      currentDate.setDate(currentDate.getDate() + 1);
      dateCol += 2;
    }

    setHeader('BZ', 'Total Meals', '', colorO_CF);
    setHeader('CB', 'Date', '', colorO_CF);
    setHeader('CC', 'Name', '', colorO_CF);
    setHeader('CD', 'Bazer Details', '', colorO_CF);
    setHeader('CE', 'Cost', '', colorO_CF);

    // M formulas
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
    sheet.getCell(`L7`).value = { formula: `SUM(BZ3:BZ${lastRow})` };
    sheet.getCell(`L7`).numFmt = '0';
    
    sheet.getCell('L10').value = 'Total Cost';
    sheet.getCell('L10').font = fontBold;
    sheet.getCell(`L11`).value = { formula: `SUM(CE3:CE${lastRow})` };
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
      const periodDeposit = periodDepositMap.get(student.id) || 0;
      
            applyCell('A', student.diningId);
      applyCell('B', student.name);
      applyCell('C', periodDeposit); // Deposite 1
      applyCell('D', 0); // Deposite 2
      applyCell('E', 0); // Deposite 3
      applyCell('F', { formula: `SUM(C${r}:E${r})` });
      
            applyCell('H', { formula: `SUM(F${r}+0)` });
      applyCell('I', { formula: `BZ${r}*$L$4` }); // Calculates live cost
      applyCell('J', { formula: `H${r}-I${r}` }); // Calculates live balance // Calculates live balance
      
            applyCell('N', student.diningId);
      applyCell('O', student.name);

      let mc = 16;
      let totalMealsForStudent = 0;
      for (let i = 0; i < 31; i++) {
        let lVal: number | string = '';
        let dVal: number | string = '';
        
        if (i < daysList.length) {
          const d = daysList[i];
          const { autoOff } = isStudentAutoOff(balance, activePeriod, d, periodDeposit);
          if (autoOff) {
            lVal = 0; dVal = 0;
          } else {
            const dStr = d.toISOString().split('T')[0];
            const s = scheduleMap.get(dStr)?.get(student.id);
            lVal = s ? (s.lunch ? 1 : 0) : 1;
            dVal = s ? (s.dinner ? 1 : 0) : 1;
          }
        }
        
        const cellL = row.getCell(mc);
        cellL.value = lVal;
        cellL.font = fontNormal; cellL.alignment = alignCenter; cellL.border = borderStyle;
        
        const cellD = row.getCell(mc+1);
        cellD.value = dVal;
        cellD.font = fontNormal; cellD.alignment = alignCenter; cellD.border = borderStyle;
        
        mc += 2;
      }

            const cellCA = sheet.getCell(`BZ${r}`);
      cellCA.value = { formula: `SUM(P${r}:BY${r})` };
      cellCA.font = fontNormal;
      cellCA.fill = colorTotalMeals;
      cellCA.alignment = alignCenter;
      cellCA.border = borderStyle;
      cellCA.numFmt = '0';

      // Ensure CF area is clear initially
            applyCell('CB', ''); 
      applyCell('CC', ''); 
      applyCell('CD', ''); 
      applyCell('CE', ''); 

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
    
    applyTotal('E', `SUM(E3:E${lastRow})`);
    applyTotal('F', `SUM(F3:F${lastRow})`);
    applyTotal('G', `SUM(G3:G${lastRow})`);
    applyTotal('H', `SUM(H3:H${lastRow})`);

    let tc = 19; // S
    for (let i = 0; i < 62; i++) {
      const colLetter = sheet.getColumn(tc).letter;
      applyTotal(colLetter, `SUM(${colLetter}3:${colLetter}${lastRow})`);
      tc++;
    }

    applyTotal('CC', `SUM(S${totalRowIdx}:CB${totalRowIdx})`);
    sheet.getCell(`CC${totalRowIdx}`).fill = colorTotalMeals;
    applyTotal('CH', `SUM(CH3:CH${lastRow})`);

    // Fill Bazaar actual data
    let bRow = 3;
    for (const b of bazaars) {
      if (bRow > lastRow) break; // If we exceed student rows, just stop for safety
      sheet.getCell(`CB${bRow}`).value = new Date(b.date);
      sheet.getCell(`CB${bRow}`).numFmt = 'dd-mm-yyyy';
      sheet.getCell(`CC${bRow}`).value = b.name || 'Bazaar';
      sheet.getCell(`CD${bRow}`).value = b.details || '';
      sheet.getCell(`CE${bRow}`).value = b.amount;
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
