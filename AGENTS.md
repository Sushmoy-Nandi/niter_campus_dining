<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-specific-rules -->
# Campus Dining ERP Rules
1. **Meal Suspension Logic:** Do NOT check `MealSchedule` alone to determine if a student is eating. Always use `isStudentAutoOff(balance, activePeriod, date, periodDeposit)` from `src/lib/meal-utils.ts` to verify if they are auto-suspended.
2. **bKash Webhook:** Handled via SMS forwarding to `/api/bkash-webhook?secret=...`. Webhook stores in `BkashLedger`.
3. **QR Codes:** Payload must be JSON `{"studentId": "...", "type": "MEAL_CHECKIN"}` for the Admin Scanner.
4. **Git Commits & Pushes:** NEVER commit or push code to GitHub without explicitly taking permission from the user first. The user must review changes locally before a push is allowed.
<!-- END:project-specific-rules -->
