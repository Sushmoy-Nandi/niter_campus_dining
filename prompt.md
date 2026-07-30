# Comprehensive Codebase Audit & Mathematical Logic Verification Prompt

Please scan the entire codebase to perform a deep, structural audit with a primary focus on permanent stability, correct mathematical calculations, and robust error handling. 

Your objective is to ensure that the code is not just patched for one-off edge cases, but fundamentally hardened to work correctly for all future scenarios (e.g., dynamic date ranges, variable pricing, edge-case math).

## 1. Deep Codebase Scan & Error Detection
- Thoroughly scan all directories, particularly focusing on `src/app/api`, `src/lib`, and any Google Sheets Apps Scripts (like `public/GoogleSheetsAppScript.txt`).
- Identify any hidden runtime errors, unhandled promise rejections, unchecked null/undefined variables, and type safety issues.
- Check for timezone offset bugs (e.g., UTC vs GMT+6) when handling dates, ensuring date ranges are fully inclusive and timezone-agnostic.
- Verify database queries (Prisma) to ensure unique constraints and relationships are safely handled without race conditions.

## 2. Mathematical & Financial Logic Verification (CRITICAL)
- Audit all mathematical calculations related to finances, billing, deposits, meal rates, and balances.
- Ensure that `Deposit`, `Cost`, `On-Hand`, and `Carry-Over` formulas do not double-count or mistakenly overwrite values.
- Verify that dynamic meal rates (Total Cost / Total Meals) handle division by zero safely and calculate accurately to 2 decimal places.
- Verify that wallet balances are updated correctly and that transient/live values are calculated distinctly from permanent database deductions.

## 3. Permanent, Future-Proof Fixes
- **Do not apply band-aid fixes.** If an array index is hardcoded (e.g., `for (let i = 0; i < 31; i++)`), replace it with dynamic length checks (`i < days.length`) so it works for 28-day, 30-day, or 35-day periods without breaking.
- If a calculation depends on rigid assumptions, refactor it to dynamically adapt to any scenario (e.g., future time periods, different timezone servers, variable column lengths in Excel/Google Sheets).

## 4. Fix, Explain, and Suggest
1. **Fix all identified errors:** Modify the code directly to implement these permanent solutions.
2. **Explain the Errors:** For every bug you find, provide a clear, plain-English explanation of why it was failing and how the mathematical or logical flaw occurred.
3. **Explain the Fixes:** Describe exactly what you changed to guarantee it will never happen again in the future.
4. **Architectural Suggestions:** Provide 3-5 actionable recommendations to further improve the security, performance, or UI/UX of this system.
