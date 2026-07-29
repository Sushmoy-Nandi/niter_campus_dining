# Campus Dining NITER

Meal Management System for **National Institute of Textile Engineering and Research (NITER)**, Savar, Dhaka, Bangladesh.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL
- **ORM:** Prisma 7
- **Authentication:** NextAuth.js v5 (Credentials)
- **Charts:** Recharts

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup Instructions

### 1. Clone and install dependencies

```bash
npm install
```

### 2. PostgreSQL setup

Create a PostgreSQL database:

```sql
CREATE DATABASE campus_dining_niter;
```

### 3. Environment variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/campus_dining_niter"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Run Prisma migrations

```bash
npx prisma migrate dev --name init
```

### 5. Seed the database

```bash
npx prisma db seed
```

### 6. Start the development server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Default Admin Login

- **Email:** admin@gmail.com
- **Password:** Admin123!

## Features

### Student
- Registration and secure login
- View wallet balance and transaction history
- **Automated bKash Deposits** via SMS Webhook integration
- Toggle lunch/dinner ON/OFF for any date
- View today's and tomorrow's meal status
- **Digital Dining Pass (QR Code)** for meal check-in
- **Active Polls & Feedback** for menu choices and food rating
- Profile with editable personal information

### Admin & Staff
- Dashboard with charts (daily meals, deposits vs deductions)
- Student management and QR Code Scanning API
- Manual and bulk deposit processing
- **bKash Ledger** for tracking automated SMS deposits
- **Dining Periods** management (start/end dates, minimum deposits)
- **Bazaar** management for tracking daily market costs
- Dynamic meal rate configuration based on bazaar costs
- Monthly report generation with CSV export
- **System Settings & Database Backups**

## Database Schema

- **Student / User** - Profiles and Authentication
- **Wallet & Transaction** - Balance and ledger tracking
- **BkashLedger** - Automated SMS deposit verification
- **MealRate & DailyCharge** - Configurable pricing and charges
- **MealSchedule** - Daily meal ON/OFF per student
- **Bazaar & DiningPeriod** - Market costs and period administration
- **Poll, PollOption, Vote, Feedback** - Student engagement
- **AuditLog** - Admin action tracking

## Business Rules

- Meal changes allowed only for future dates (same-day cutoff at 10:00 AM)
- **Auto-Suspension:** Students failing to meet the minimum deposit threshold for a Dining Period, or falling to a zero/negative balance, have their meals auto-suspended system-wide.
- All financial operations use Prisma transactions.

## Project Structure

```
src/
  app/
    api/             - Next.js API Routes (student, admin, bkash-webhook, auth)
    student/         - Student portal (Dashboard, Meals, Calendar, Wallet, Polls, Profile)
    admin/           - Admin portal (Dashboard, Students, Deposits, Bazaar, Scanner, Settings)
  components/
    layout/          - Providers, Sidebar, Navbar
    ui/              - shadcn/ui components
  lib/               - Prisma client, meal logic (meal-utils.ts), auth config
prisma/
  schema.prisma      - Database schema definition
```
"# niter_campus_dining" 
