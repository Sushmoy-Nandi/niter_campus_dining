/**
 * Google Apps Script to Sync the Campus Dining NITER Workbook LIVE
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Replace the code with this script.
 * 4. Update the CONFIG variable with your actual website URL and secret key.
 * 5. Run the `onOpen` function once to create the custom menu.
 * 6. You can now use the "Campus Dining Sync" menu in Google Sheets to pull live data.
 */

const CONFIG = {
  // Replace with your actual live deployed URL (e.g., https://your-app.vercel.app)
  API_URL: 'http://localhost:3000', 
  // Replace with your NEXT_PUBLIC_MASTER_SHEET_SECRET
  SECRET_KEY: 'NITER_MASTER_2026'
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Campus Dining Sync')
    .addItem('Sync Live Master Sheet', 'syncLiveMasterSheet')
    .addToUi();
}

function syncLiveMasterSheet() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const response = UrlFetchApp.fetch(`${CONFIG.API_URL}/api/admin/live-json?secret=${CONFIG.SECRET_KEY}`);
    const data = JSON.parse(response.getContentText());
    
    buildSheetWithData(data);
    ui.alert('Success', `Live data for "${data.period.title}" has been successfully synced and formatted!`, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('Error', `Failed to sync live data: ${error.message}`, ui.ButtonSet.OK);
  }
}

function buildSheetWithData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(data.period.title);
  
  if (!sheet) {
    sheet = ss.insertSheet(data.period.title);
  } else {
    sheet.clear();
  }
  
  // Set basic dimensions (max 305 rows, 84 columns)
  const requiredRows = Math.max(305, data.students.length + 10);
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 86) sheet.insertColumnsAfter(sheet.getMaxColumns(), 86 - sheet.getMaxColumns());
  
  // Colors
  const colorA_G = '#c9daf8';
  const colorI_K = '#d9d2e9';
  const colorO_CF = '#9fc5e8';
  const colorTotalMeals = '#6aa84f';
  
  // Custom colorful deposits
  const colorDep1 = '#ffe599'; // Pastel Yellow
  const colorDep2 = '#f9cb9c'; // Pastel Orange
  const colorDep3 = '#b6d7a8'; // Pastel Green
  
  // Freeze panes
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);

  // Column Widths
    sheet.setColumnWidth(1, 100); // A: ID
  sheet.setColumnWidth(2, 160); // B: Name
  sheet.setColumnWidth(3, 100); // C: Deposite 1
  sheet.setColumnWidth(4, 100); // D: Deposite 2
  sheet.setColumnWidth(5, 100); // E: Deposite 3
  sheet.setColumnWidth(6, 75);  // F: Total Deposite
  sheet.setColumnWidth(7, 20);  // G: Sep
  sheet.setColumnWidth(8, 100); // H: Deposite
  sheet.setColumnWidth(9, 40); // I: Blank
  sheet.setColumnWidth(10, 85); // J: Deposite
  sheet.setColumnWidth(11, 90); // K: Cost
  sheet.setColumnWidth(12, 90); // L: On-Hand
  sheet.setColumnWidth(13, 60); // M: Blank
  sheet.setColumnWidth(14, 135); // N: Meal Rate
  sheet.setColumnWidth(15, 55); // O: Blank
   // P: SL
  sheet.setColumnWidth(17, 170); // Q: Name
   // R: ID
  
  // Q to BZ (Dates)
  let cIndex = 16;
  for (let i = 0; i < 31; i++) {
    sheet.setColumnWidth(cIndex, 35);
    sheet.setColumnWidth(cIndex + 1, 35);
    cIndex += 2;
  }
  
  sheet.setColumnWidth(81, 70); // CC: Total Meals
  sheet.setColumnWidth(82, 40); // CD: Blank
  sheet.setColumnWidth(83, 140); // CE: Date
  sheet.setColumnWidth(84, 190); // CF: Name
  sheet.setColumnWidth(85, 350); // CG: Bazer Details
  sheet.setColumnWidth(86, 120); // CH: Cost

  // --- ROW 1 & 2 HEADERS ---
  sheet.setRowHeight(1, 40);
  sheet.setRowHeight(2, 25);
  
  const setHeader = (col, val1, val2, color, merge = true) => {
    const range1 = sheet.getRange(1, col);
    range1.setValue(val1).setFontWeight("bold").setBackground(color)
      .setHorizontalAlignment("center").setVerticalAlignment("middle")
      .setWrap(true).setBorder(true, true, true, true, false, false);
      
    if (merge) {
      sheet.getRange(1, col, 2, 1).merge();
    } else {
      const range2 = sheet.getRange(2, col);
      range2.setValue(val2).setFontWeight("bold").setBackground(color)
        .setHorizontalAlignment("center").setVerticalAlignment("middle")
        .setWrap(true).setBorder(true, true, true, true, false, false);
    }
  };
  
  const lastRow = data.students.length + 2;
  const totalRowIdx = lastRow + 1;

    setHeader(1, 'ID', '', colorA_G);
  setHeader(2, 'Name', '', colorA_G);
  
  
  sheet.getRange(1, 3).setFormula(`="Deposite 1 "&CHAR(10)&SUM(C${totalRowIdx}+0)`);
  sheet.getRange(1, 3, 2, 1).merge().setFontWeight("bold").setBackground(colorDep1).setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
  
  sheet.getRange(1, 4).setFormula(`="Deposite 2 "&CHAR(10)&SUM(D${totalRowIdx}+0)`);
  sheet.getRange(1, 4, 2, 1).merge().setFontWeight("bold").setBackground(colorDep2).setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
  
  sheet.getRange(1, 3).setFormula(`="Deposite 1 "&CHAR(10)&SUM(C${totalRowIdx}+0)`);
  sheet.getRange(1, 3, 2, 1).merge().setFontWeight("bold").setBackground(colorDep3).setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
  
  sheet.getRange(1, 4).setFormula(`="Deposite 2 "&CHAR(10)&SUM(D${totalRowIdx}+0)`);
  sheet.getRange(1, 4, 2, 1).merge().setFontWeight("bold").setBackground(colorA_G).setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);

  setHeader(8, 'Deposite', '', colorI_K);
  setHeader(9, 'Cost', '', colorI_K);
  setHeader(10, 'On-Hand', '', colorI_K);
  
  // M header (now blank)
  sheet.getRange(1, 14, 2, 1).setBorder(true, true, true, true, false, false);
  
  setHeader(14, 'ID', '', colorO_CF);
  setHeader(15, 'Name', '', colorO_CF);
  
  let dateCol = 16; // P
  for (let i = 0; i < 31; i++) {
    const dStr = data.days[i];
    const range = sheet.getRange(1, dateCol);
    
    if (dStr) {
      range.setValue(new Date(dStr)).setNumberFormat('d-MMM');
    }
    
    range.setFontWeight("bold").setBackground(colorO_CF)
      .setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
      
    sheet.getRange(1, dateCol, 1, 2).merge();
    sheet.getRange(1, dateCol + 1).setBorder(true, true, true, true, false, false);
    
    sheet.getRange(2, dateCol).setValue('L').setFontWeight("normal").setBackground(colorO_CF)
      .setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
    sheet.getRange(2, dateCol + 1).setValue('D').setFontWeight("normal").setBackground(colorO_CF)
      .setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false);
    
    dateCol += 2;
  }
  
  setHeader(78, 'Total Meals', '', colorO_CF);
  setHeader(80, 'Date', '', colorO_CF);
  setHeader(81, 'Name', '', colorO_CF);
  setHeader(82, 'Bazer Details', '', colorO_CF);
  setHeader(83, 'Cost', '', colorO_CF);

  // M formulas will be written AFTER bulk write to avoid being overwritten

  // Row 3 to lastRow
  if (data.students.length > 0) {
    let r = 3;
    let sl = 1;
    
    // We will build a 2D array for faster writes
    const values = [];
    const backgrounds = [];
    const weights = [];
    
    for (const student of data.students) {
      const row = new Array(86).fill('');
      
      row[0] = sl;
      row[1] = student.name;
      row[2] = student.diningId;
      row[3] = student.department;
      row[4] = student.deposit;
      row[6] = 0;
      row[6] = 0;
      row[7] = `=SUM(E${r}:G${r})`;
      
            row[7] = `=SUM(F${r}+0)`;
      row[8] = `=BZ${r}*$L$4`;
      row[9] = `=H${r}-I${r}`;
      
            row[13] = student.diningId;
      row[14] = student.name;
      
      let mc = 15; // 0-indexed for 17(Q)
      for (let i = 0; i < 31; i++) {
        const mealData = student.meals[i];
        if (mealData) {
          row[mc] = mealData.l;
          row[mc+1] = mealData.d;
        } else {
          row[mc] = '';
          row[mc+1] = '';
        }
        mc += 2;
      }
      
      row[77] = `=SUM(P${r}:BY${r})`;
      
      values.push(row);
      r++;
      sl++;
    }
    
    // Bulk write the values
    const dataRange = sheet.getRange(3, 1, data.students.length, 86);
    dataRange.setValues(values);
    
    // Apply borders and alignments to data area
    dataRange.setHorizontalAlignment("center");
    
    // Set specific borders, let's just border the important columns
    // A to H
    sheet.getRange(3, 1, data.students.length, 8).setBorder(true, true, true, true, false, false);
    // J to L
    sheet.getRange(3, 8, data.students.length, 3).setBorder(true, true, true, true, false, false);
    // P to BZ
    sheet.getRange(3, 14, data.students.length, 65).setBorder(true, true, true, true, false, false);
    
    sheet.getRange(3, 78, data.students.length, 1).setBackground(colorTotalMeals).setNumberFormat('0');

    // Apply strict number formatting to money columns to prevent Date misinterpretations
    sheet.getRange(3, 3, data.students.length, 4).setNumberFormat('0.00'); // E,F,G,H
    sheet.getRange(3, 8, data.students.length, 3).setNumberFormat('0.00'); // J,K,L
  }
  
  // Write N formulas here so they are not overwritten by the bulk empty string fill
  sheet.getRange('L3').setValue('Current Meal Rate').setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange('L4').setFormula('=IFERROR(L11/L7, 0)').setHorizontalAlignment("center").setFontWeight("bold").setNumberFormat('0.00');
  sheet.getRange('L6').setValue('Total Meal Count').setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange('L7').setFormula(`=SUM(BZ3:BZ${lastRow})`).setNumberFormat('0').setHorizontalAlignment("center");
  sheet.getRange('L10').setValue('Total Cost').setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange('L11').setFormula(`=SUM(CE3:CE${lastRow})`).setNumberFormat('0.00').setHorizontalAlignment("center");
  sheet.getRange('L13').setValue('On-Hand').setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange('L14').setFormula(`=SUM(J3:J${lastRow})`).setNumberFormat('0.00').setHorizontalAlignment("center");

  // Apply borders to the N column blocks
  sheet.getRange('L3:L4').setBorder(true, true, true, true, false, false);
  sheet.getRange('L6:L7').setBorder(true, true, true, true, false, false);
  sheet.getRange('L10:L11').setBorder(true, true, true, true, false, false);
  sheet.getRange('L13:L14').setBorder(true, true, true, true, false, false);
  
  // TOTALS Row
  const tr = totalRowIdx;
  sheet.getRange(tr, 8).setFormula(`=SUM(H3:H${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sheet.getRange(tr, 8).setFormula(`=SUM(H3:H${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sheet.getRange(tr, 8).setFormula(`=SUM(H3:H${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sheet.getRange(tr, 8).setFormula(`=SUM(H3:H${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  
  for (let c = 16; c <= 77; c++) {
    let ltr = sheet.getRange(1, c).getA1Notation().match(/([A-Z]+)/)[0];
    sheet.getRange(tr, c).setFormula(`=SUM(${ltr}3:${ltr}${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  }
  
  sheet.getRange(tr, 81).setFormula(`=SUM(S${tr}:CB${tr})`).setBackground(colorTotalMeals).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sheet.getRange(tr, 86).setFormula(`=SUM(CE3:CE${lastRow})`).setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  
  // Bazaar info
  let bRow = 3;
  for (const b of data.bazaars) {
    if (bRow > lastRow) break;
    sheet.getRange(bRow, 80).setValue(new Date(b.date)).setNumberFormat('dd-MMM-yyyy').setBorder(true, true, true, true, false, false);
    sheet.getRange(bRow, 81).setValue(b.name || 'Bazaar').setBorder(true, true, true, true, false, false);
    sheet.getRange(bRow, 82).setValue(b.details || '').setBorder(true, true, true, true, false, false);
    sheet.getRange(bRow, 80).setValue(b.amount).setBorder(true, true, true, true, false, false);
    bRow++;
  }
}
