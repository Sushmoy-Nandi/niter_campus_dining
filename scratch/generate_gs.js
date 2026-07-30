const fs = require('fs');
let code = fs.readFileSync('Untracked/GoogleSheetsAppScript.gs', 'utf8');

// Replace column widths
code = code.replace(/sheet\.setColumnWidth\(1, 40\);.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n.*?\n/m, 
`  sheet.setColumnWidth(1, 100); // A: ID
  sheet.setColumnWidth(2, 160); // B: Name
  sheet.setColumnWidth(3, 100); // C: Deposite 1
  sheet.setColumnWidth(4, 100); // D: Deposite 2
  sheet.setColumnWidth(5, 100); // E: Deposite 3
  sheet.setColumnWidth(6, 75);  // F: Total Deposite
  sheet.setColumnWidth(7, 20);  // G: Sep
  sheet.setColumnWidth(8, 100); // H: Deposite
`);

code = code.replace(/sheet\.setColumnWidth\(9, 20\);/g, 'sheet.setColumnWidth(9, 100); // I: Cost');
code = code.replace(/sheet\.setColumnWidth\(10, 100\);/g, 'sheet.setColumnWidth(10, 100); // J: On-Hand');
code = code.replace(/sheet\.setColumnWidth\(11, 100\);/g, 'sheet.setColumnWidth(11, 20); // K: Sep');
code = code.replace(/sheet\.setColumnWidth\(12, 100\);/g, 'sheet.setColumnWidth(12, 120); // L: Stats');
code = code.replace(/sheet\.setColumnWidth\(13, 20\);/g, 'sheet.setColumnWidth(13, 20); // M: Sep');
code = code.replace(/sheet\.setColumnWidth\(14, 120\);/g, 'sheet.setColumnWidth(14, 100); // N: ID');
code = code.replace(/sheet\.setColumnWidth\(15, 20\);/g, 'sheet.setColumnWidth(15, 160); // O: Name');
code = code.replace(/sheet\.setColumnWidth\(16, 40\);/g, ''); // P is Day 1 now
code = code.replace(/sheet\.setColumnWidth\(17, 160\);/g, '');
code = code.replace(/sheet\.setColumnWidth\(18, 100\);/g, '');
code = code.replace(/sheet\.setColumnWidth\(17, 150\);/g, ''); // fallback
code = code.replace(/sheet\.setColumnWidth\(18, 80\);/g, ''); // fallback

// Frozen
code = code.replace(/sheet\.setFrozenColumns\(3\);/g, 'sheet.setFrozenColumns(2);');

// headers
code = code.replace(/setHeader\(1, 'SL', '', colorA_G\);\n.*?\n.*?\n.*?\n/m, 
`  setHeader(1, 'ID', '', colorA_G);
  setHeader(2, 'Name', '', colorA_G);
  
`);

// Dep headers
code = code.replace(/sheet\.getRange\(1, 5\)\.setFormula.*?E\$\{totalRowIdx}.*?;/g, 'sheet.getRange(1, 3).setFormula(`="Deposite 1 "&CHAR(10)&SUM(C${totalRowIdx}+0)`);');
code = code.replace(/sheet\.getRange\(1, 5, 2, 1\)/g, 'sheet.getRange(1, 3, 2, 1)');
code = code.replace(/sheet\.getRange\(1, 6\)\.setFormula.*?F\$\{totalRowIdx}.*?;/g, 'sheet.getRange(1, 4).setFormula(`="Deposite 2 "&CHAR(10)&SUM(D${totalRowIdx}+0)`);');
code = code.replace(/sheet\.getRange\(1, 6, 2, 1\)/g, 'sheet.getRange(1, 4, 2, 1)');
code = code.replace(/sheet\.getRange\(1, 7\)\.setFormula.*?G\$\{totalRowIdx}.*?;/g, 'sheet.getRange(1, 5).setFormula(`="Deposite 3 "&CHAR(10)&SUM(E${totalRowIdx}+0)`);');
code = code.replace(/sheet\.getRange\(1, 7, 2, 1\)/g, 'sheet.getRange(1, 5, 2, 1)');
code = code.replace(/sheet\.getRange\(1, 8\)\.setFormula.*?H\$\{totalRowIdx}.*?;/g, 'sheet.getRange(1, 6).setFormula(`="Total Deposite "&CHAR(10)&SUM(F${totalRowIdx}+0)`);');
code = code.replace(/sheet\.getRange\(1, 8, 2, 1\)/g, 'sheet.getRange(1, 6, 2, 1)');

code = code.replace(/setHeader\(10, 'Deposite'/g, "setHeader(8, 'Deposite'");
code = code.replace(/setHeader\(11, 'Cost'/g, "setHeader(9, 'Cost'");
code = code.replace(/setHeader\(12, 'On-Hand'/g, "setHeader(10, 'On-Hand'");

code = code.replace(/setHeader\(16, 'SL'/g, "setHeader(14, 'ID'");
code = code.replace(/setHeader\(17, 'Name'/g, "setHeader(15, 'Name'");
code = code.replace(/setHeader\(18, 'ID'/g, '');

// Date columns
code = code.replace(/let cIndex = 19;/g, 'let cIndex = 16;');

code = code.replace(/setHeader\(81, 'Total Meals'/g, "setHeader(78, 'Total Meals'");
code = code.replace(/setHeader\(83, 'Date'/g, "setHeader(80, 'Date'");
code = code.replace(/setHeader\(84, 'Name'/g, "setHeader(81, 'Name'");
code = code.replace(/setHeader\(85, 'Bazer Details'/g, "setHeader(82, 'Bazer Details'");
code = code.replace(/setHeader\(86, 'Cost'/g, "setHeader(83, 'Cost'");

// Row formulas
code = code.replace(/row\[0\] = sl;\s+row\[1\] = student\.name;\s+row\[2\] = student\.diningId;\s+row\[3\] = student\.department \|\| '';\s+row\[4\] = periodDeposit;\s+row\[5\] = 0;\s+row\[6\] = 0;\s+row\[7\] = \`=SUM\(E\$\{r\}:G\$\{r\}\)\`;/m, 
`      row[0] = student.diningId;
      row[1] = student.name;
      row[2] = periodDeposit;
      row[3] = 0;
      row[4] = 0;
      row[5] = \`=SUM(C\${r}:E\${r})\`;`);

code = code.replace(/row\[9\] = \`=SUM\(H\$\{r\}\+0\)\`;\s+row\[10\] = \`=CC\$\{r\}\*\$N\$4\`;\s+row\[11\] = \`=J\$\{r\}-K\$\{r\}\`;/m,
`      row[7] = \`=SUM(F\${r}+0)\`;
      row[8] = \`=BZ\${r}*$L$4\`;
      row[9] = \`=H\${r}-I\${r}\`;`);

code = code.replace(/row\[15\] = sl;\s+row\[16\] = student\.name;\s+row\[17\] = student\.diningId;/m,
`      row[13] = student.diningId;
      row[14] = student.name;`);

code = code.replace(/let mc = 18;/g, 'let mc = 15;');

code = code.replace(/row\[80\] = \`=SUM\(S\$\{r\}:CB\$\{r\}\)\`;/g, 'row[77] = `=SUM(P${r}:BY${r})`;');

// Borders
code = code.replace(/sheet\.getRange\(3, 1, data\.students\.length, 12\)\.setBorder/g, 'sheet.getRange(3, 1, data.students.length, 10).setBorder');
code = code.replace(/sheet\.getRange\(3, 16, data\.students\.length, 66\)\.setBorder/g, 'sheet.getRange(3, 14, data.students.length, 65).setBorder');
code = code.replace(/sheet\.getRange\(3, 81, data\.students\.length, 1\)/g, 'sheet.getRange(3, 78, data.students.length, 1)');
code = code.replace(/sheet\.getRange\(3, 5, data\.students\.length, 4\)/g, 'sheet.getRange(3, 3, data.students.length, 4)');
code = code.replace(/sheet\.getRange\(3, 10, data\.students\.length, 3\)/g, 'sheet.getRange(3, 8, data.students.length, 3)');

// N block to L block
code = code.replace(/sheet\.getRange\('N3'\)/g, 'sheet.getRange(\'L3\')');
code = code.replace(/sheet\.getRange\('N4'\)/g, 'sheet.getRange(\'L4\')');
code = code.replace(/sheet\.getRange\('N6'\)/g, 'sheet.getRange(\'L6\')');
code = code.replace(/sheet\.getRange\('N7'\)/g, 'sheet.getRange(\'L7\')');
code = code.replace(/sheet\.getRange\('N10'\)/g, 'sheet.getRange(\'L10\')');
code = code.replace(/sheet\.getRange\('N11'\)/g, 'sheet.getRange(\'L11\')');
code = code.replace(/sheet\.getRange\('N13'\)/g, 'sheet.getRange(\'L13\')');
code = code.replace(/sheet\.getRange\('N14'\)/g, 'sheet.getRange(\'L14\')');

code = code.replace(/=IFERROR\(N11\/N7, 0\)/g, '=IFERROR(L11/L7, 0)');
code = code.replace(/=SUM\(CC3:CC\$\{lastRow\}\)/g, '=SUM(BZ3:BZ${lastRow})');
code = code.replace(/=SUM\(CH3:CH\$\{lastRow\}\)/g, '=SUM(CE3:CE${lastRow})');
code = code.replace(/=SUM\(L3:L\$\{lastRow\}\)/g, '=SUM(J3:J${lastRow})');

code = code.replace(/sheet\.getRange\('N3:N4'\)/g, 'sheet.getRange(\'L3:L4\')');
code = code.replace(/sheet\.getRange\('N6:N7'\)/g, 'sheet.getRange(\'L6:L7\')');
code = code.replace(/sheet\.getRange\('N10:N11'\)/g, 'sheet.getRange(\'L10:L11\')');
code = code.replace(/sheet\.getRange\('N13:N14'\)/g, 'sheet.getRange(\'L13:L14\')');

// Bazaar mapping
code = code.replace(/sheet\.getRange\(bRow, 83\)/g, 'sheet.getRange(bRow, 80)');
code = code.replace(/sheet\.getRange\(bRow, 84\)/g, 'sheet.getRange(bRow, 81)');
code = code.replace(/sheet\.getRange\(bRow, 85\)/g, 'sheet.getRange(bRow, 82)');
code = code.replace(/sheet\.getRange\(bRow, 86\)/g, 'sheet.getRange(bRow, 83)');

fs.writeFileSync('Untracked/GoogleSheetsAppScript.gs', code);
