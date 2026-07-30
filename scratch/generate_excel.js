const fs = require('fs');
let code = fs.readFileSync('src/app/api/admin/export-excel/route.ts', 'utf8');

// Col widths
code = code.replace(/sheet\.getColumn\('A'\)\.width[\s\S]*?sheet\.getColumn\('R'\)\.width = 12; \/\/ ID/m,
`    sheet.getColumn('A').width = 12; // ID
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
    sheet.getColumn('O').width = 19.25; // Name`);

code = code.replace(/let cIndex = 17;/g, 'let cIndex = 16;');

code = code.replace(/sheet\.getColumn\('CA'\)\.width[\s\S]*?sheet\.getColumn\('CH'\)\.width = 15\.25;/m,
`    sheet.getColumn('BZ').width = 8.88;
    sheet.getColumn('CA').width = 4.75;
    sheet.getColumn('CB').width = 17.88;
    sheet.getColumn('CC').width = 24.13;
    sheet.getColumn('CD').width = 44;
    sheet.getColumn('CE').width = 15.25;`);

// Headers
code = code.replace(/setHeader\('A', 'SL', '', colorA_G\);\s+setHeader\('B', 'Name', '', colorA_G\);\s+setHeader\('C', 'ID', '', colorA_G\);\s+setHeader\('D', 'Info', '', colorA_G\);/m,
`    setHeader('A', 'ID', '', colorA_G);
    setHeader('B', 'Name', '', colorA_G);`);

code = code.replace(/setHeader\('E', \{ formula: \`="Deposite 1 "\&CHAR\(10\)\&SUM\(E\$\{totalRowIdx\}\+0\)\` \}, '', colorDep1\);/g, 'setHeader(\'C\', { formula: `="Deposite 1 "&CHAR(10)&SUM(C${totalRowIdx}+0)` }, \'\', colorDep1);');
code = code.replace(/setHeader\('F', \{ formula: \`="Deposite 2 "\&CHAR\(10\)\&SUM\(F\$\{totalRowIdx\}\+0\)\` \}, '', colorDep2\);/g, 'setHeader(\'D\', { formula: `="Deposite 2 "&CHAR(10)&SUM(D${totalRowIdx}+0)` }, \'\', colorDep2);');
code = code.replace(/setHeader\('G', \{ formula: \`="Deposite 3 "\&CHAR\(10\)\&SUM\(G\$\{totalRowIdx\}\+0\)\` \}, '', colorDep3\);/g, 'setHeader(\'E\', { formula: `="Deposite 3 "&CHAR(10)&SUM(E${totalRowIdx}+0)` }, \'\', colorDep3);');
code = code.replace(/setHeader\('H', \{ formula: \`="Total Deposite "\&CHAR\(10\)\&SUM\(H\$\{totalRowIdx\}\+0\)\` \}, '', colorA_G\);/g, 'setHeader(\'F\', { formula: `="Total Deposite "&CHAR(10)&SUM(F${totalRowIdx}+0)` }, \'\', colorA_G);');

code = code.replace(/setHeader\('J', 'Deposite', '', colorI_K\);/g, 'setHeader(\'H\', \'Deposite\', \'\', colorI_K);');
code = code.replace(/setHeader\('K', 'Cost', '', colorI_K\);/g, 'setHeader(\'I\', \'Cost\', \'\', colorI_K);');
code = code.replace(/setHeader\('L', 'On-Hand', '', colorI_K\);/g, 'setHeader(\'J\', \'On-Hand\', \'\', colorI_K);');

code = code.replace(/const m1 = r1\.getCell\('N'\);\s+m1\.border = borderStyle;\s+const m2 = r2\.getCell\('N'\);\s+m2\.border = borderStyle;/m,
`    const m1 = r1.getCell('L');
    m1.border = borderStyle;
    const m2 = r2.getCell('L');
    m2.border = borderStyle;`);

code = code.replace(/setHeader\('P', 'SL', '', colorO_CF\);\s+setHeader\('Q', 'Name', '', colorO_CF\);\s+setHeader\('R', 'ID', '', colorO_CF\);/m,
`    setHeader('N', 'ID', '', colorO_CF);
    setHeader('O', 'Name', '', colorO_CF);`);

code = code.replace(/setHeader\('CC', 'Total Meals', '', colorO_CF\);/g, 'setHeader(\'BZ\', \'Total Meals\', \'\', colorO_CF);');
code = code.replace(/setHeader\('CE', 'Date', '', colorO_CF\);/g, 'setHeader(\'CB\', \'Date\', \'\', colorO_CF);');
code = code.replace(/setHeader\('CF', 'Name', '', colorO_CF\);/g, 'setHeader(\'CC\', \'Name\', \'\', colorO_CF);');
code = code.replace(/setHeader\('CG', 'Bazer Details', '', colorO_CF\);/g, 'setHeader(\'CD\', \'Bazer Details\', \'\', colorO_CF);');
code = code.replace(/setHeader\('CH', 'Cost', '', colorO_CF\);/g, 'setHeader(\'CE\', \'Cost\', \'\', colorO_CF);');

// N stats to L stats
code = code.replace(/sheet\.getCell\('N3'\)\.value = 'Current Meal Rate';/g, 'sheet.getCell(\'L3\').value = \'Current Meal Rate\';');
code = code.replace(/sheet\.getCell\('N3'\)\.font = fontBold;/g, 'sheet.getCell(\'L3\').font = fontBold;');
code = code.replace(/sheet\.getCell\('N4'\)\.value = \{ formula: 'IFERROR\(N11\/N7, 0\)' \};/g, 'sheet.getCell(\'L4\').value = { formula: \'IFERROR(L11/L7, 0)\' };');
code = code.replace(/sheet\.getCell\('N4'\)\.font = /g, 'sheet.getCell(\'L4\').font = ');
code = code.replace(/sheet\.getCell\('N4'\)\.alignment = /g, 'sheet.getCell(\'L4\').alignment = ');

code = code.replace(/\['N3', 'N4', 'N6', 'N7', 'N10', 'N11', 'N13', 'N14'\]/g, '[\'L3\', \'L4\', \'L6\', \'L7\', \'L10\', \'L11\', \'L13\', \'L14\']');

code = code.replace(/sheet\.getCell\('N6'\)/g, 'sheet.getCell(\'L6\')');
code = code.replace(/sheet\.getCell\(\`N7\`\)\.value = \{ formula: \`SUM\(CC3:CC\$\{lastRow\}\)\` \};/g, 'sheet.getCell(`L7`).value = { formula: `SUM(BZ3:BZ${lastRow})` };');
code = code.replace(/sheet\.getCell\(\`N7\`\)/g, 'sheet.getCell(`L7`)');
code = code.replace(/sheet\.getCell\('N10'\)/g, 'sheet.getCell(\'L10\')');
code = code.replace(/sheet\.getCell\(\`N11\`\)\.value = \{ formula: \`SUM\(CH3:CH\$\{lastRow\}\)\` \};/g, 'sheet.getCell(`L11`).value = { formula: `SUM(CE3:CE${lastRow})` };');
code = code.replace(/sheet\.getCell\(\`N11\`\)/g, 'sheet.getCell(`L11`)');
code = code.replace(/sheet\.getCell\('N13'\)/g, 'sheet.getCell(\'L13\')');
code = code.replace(/sheet\.getCell\(\`N14\`\)\.value = \{ formula: \`SUM\(L3:L\$\{lastRow\}\)\` \};/g, 'sheet.getCell(`L14`).value = { formula: `SUM(J3:J${lastRow})` };');
code = code.replace(/sheet\.getCell\(\`N14\`\)/g, 'sheet.getCell(`L14`)');

// Data rows
code = code.replace(/applyCell\('A', sl\);\s+applyCell\('B', student\.name\);\s+applyCell\('C', student\.diningId\);\s+applyCell\('D', student\.department \|\| ''\);\s+applyCell\('E', periodDeposit\); \/\/.*?\n\s+applyCell\('F', 0\);\s+applyCell\('G', 0\);\s+applyCell\('H', \{ formula: \`SUM\(E\$\{r\}:G\$\{r\}\)\` \}\);/m,
`      applyCell('A', student.diningId);
      applyCell('B', student.name);
      applyCell('C', periodDeposit); // Deposite 1
      applyCell('D', 0); // Deposite 2
      applyCell('E', 0); // Deposite 3
      applyCell('F', { formula: \`SUM(C\${r}:E\${r})\` });`);

code = code.replace(/applyCell\('J', \{ formula: \`SUM\(H\$\{r\}\+0\)\` \}\);\s+applyCell\('K', \{ formula: \`CC\$\{r\}\*\$N\$4\` \}\); \/\/.*?\n\s+applyCell\('L', \{ formula: \`J\$\{r\}-K\$\{r\}\` \}\);/m,
`      applyCell('H', { formula: \`SUM(F\${r}+0)\` });
      applyCell('I', { formula: \`BZ\${r}*$L$4\` }); // Calculates live cost
      applyCell('J', { formula: \`H\${r}-I\${r}\` }); // Calculates live balance`);

code = code.replace(/applyCell\('P', sl\);\s+applyCell\('Q', student\.name\);\s+applyCell\('R', student\.diningId\);/m,
`      applyCell('N', student.diningId);
      applyCell('O', student.name);`);

code = code.replace(/let mc = 19;/g, 'let mc = 16;');

code = code.replace(/const cellCA = sheet\.getCell\(\`CC\$\{r\}\`\);\s+cellCA\.value = \{ formula: \`SUM\(S\$\{r\}:CB\$\{r\}\)\` \};/m,
`      const cellCA = sheet.getCell(\`BZ\${r}\`);
      cellCA.value = { formula: \`SUM(P\${r}:BY\${r})\` };`);

code = code.replace(/applyCell\('CE', ''\);\s+applyCell\('CF', ''\);\s+applyCell\('CG', ''\);\s+applyCell\('CH', ''\);/m,
`      applyCell('CB', ''); 
      applyCell('CC', ''); 
      applyCell('CD', ''); 
      applyCell('CE', ''); `);

// Bazaar
code = code.replace(/sheet\.getCell\(\`CE\$\{bRow\}\`\)/g, 'sheet.getCell(`CB${bRow}`)');
code = code.replace(/sheet\.getCell\(\`CF\$\{bRow\}\`\)/g, 'sheet.getCell(`CC${bRow}`)');
code = code.replace(/sheet\.getCell\(\`CG\$\{bRow\}\`\)/g, 'sheet.getCell(`CD${bRow}`)');
code = code.replace(/sheet\.getCell\(\`CH\$\{bRow\}\`\)/g, 'sheet.getCell(`CE${bRow}`)');

fs.writeFileSync('src/app/api/admin/export-excel/route.ts', code);
