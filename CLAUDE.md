# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, no flags needed)
npx prisma generate  # Regenerate Prisma client after schema changes (also runs on npm install via postinstall)
npm run db:migrate   # Run Prisma migrations (prisma migrate dev)
npm run db:seed      # Seed database with admin + 3 sample students
npm run db:reset     # Reset database and re-seed (destructive, uses --force)
```

## What This Is

Campus Dining NITER — a meal management system for a Bangladeshi university. Two roles: **Student** (toggle meals on/off, view wallet/transactions/calendar) and **Admin** (manage students, process deposits, set meal rates, generate reports). Currency is BDT.

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, shadcn/ui, Prisma 7 on PostgreSQL, NextAuth v5.

- `src/app/api/bkash-webhook` — Secure SMS webhook endpoint requiring `?secret=` for automated bKash verification.
- `src/lib/meal-utils.ts` — Contains `isStudentAutoOff()` which is the **Single Source of Truth** for determining if a student's meal is suspended (based on zero balance or missing minimum deposit for the active `DiningPeriod`).
- `src/app/student/profile` — Generates a local QR code containing `{"studentId": "...", "type": "MEAL_CHECKIN"}` for the Admin Scanner (`api/admin/scan`).

## Key Business Rules

- **Auto-Suspension (CRITICAL):** A student's meal is ON if `MealSchedule` is ON **AND** `isStudentAutoOff()` returns `false`. If `autoOff` is true, meals are suspended system-wide regardless of the schedule.
- Meal toggles allowed only for future dates; same-day changes allowed until 10:00 AM BDT.
- Wallet balance uses `Float`; financial operations must use Prisma transactions.

## Database

PostgreSQL via Prisma 7. Core models: 
`User`, `Student`, `Wallet`, `Transaction`, `MealSchedule`, `MealRate`, `Bazaar`, `DiningPeriod`, `BkashLedger` (SMS matching), `Poll`/`Vote`, and `Feedback`.

## Conventions

- Path alias: `@/*` maps to `./src/*`.
- Validation: Zod schemas in `src/lib/validations.ts` — use these for API input validation.
- State management: Zustand for client state.
- Forms: react-hook-form + @hookform/resolvers (Zod).
- Charts: Recharts.
- PDF generation: jspdf + jspdf-autotable.
- Icons: lucide-react.
- Toasts: Sonner (via `toast()` from `sonner`).

## Seed Credentials

- Admin: `admin@gmail.com` / `Admin123!`
- Students: `Register`
