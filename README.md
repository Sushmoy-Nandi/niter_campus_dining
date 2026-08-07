<div align="center">
  <h1>🍽️ Campus Dining NITER</h1>
  <p><strong>A Next-Generation, AI-Powered Meal Management System for University Campuses.</strong></p>
  <p><em>Developed for NITER Innovate Hackathon 2026 (Logistics & Welfare Track)</em></p>
</div>

---

## 🚀 Overview

**Campus Dining NITER** completely digitizes and automates the traditional university dining hall experience. By replacing chaotic Google Sheets with a centralized Next.js platform, we eliminate administrative overhead, provide complete financial transparency to students, and **eradicate identity fraud using real-time Face Recognition AI**.

### 🌟 Why We Built This
- **Manual Spreadsheet Chaos:** Replaced hours of manual meal rate calculations with our **Dynamic Pricing Engine**.
- **Identity Fraud:** Proxies eating on other students' accounts are blocked by our **Zero-Knowledge Biometric Pipeline**.
- **Missing Deposits:** Cash drops are replaced by an **Automated bKash SMS Webhook** that deposits funds directly to digital wallets.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend:** Next.js Serverless Edge API, NextAuth.js v5
- **Database:** Neon Serverless PostgreSQL, Prisma ORM
- **AI / Biometrics:** `face-api.js` (Client-side WebGL processing)
- **Integrations:** Google Apps Script (Email/Sheets Webhooks), Android SMS Forwarder (bKash)

---

## ✨ Core Features

### 🎓 For Students (The Web App)
- **One-Tap Meal Scheduling:** Toggle lunch/dinner ON/OFF up to 24 hours in advance.
- **Smart Digital Wallet:** Real-time balance tracking, transaction history, and instant bKash deposits.
- **Auto-Suspension Guard:** Meals are automatically paused if the wallet balance drops below the minimum threshold.
- **Active Student Voice:** Built-in polling and feedback system for menu choices and food quality rating.

### 🛡️ For The Dining Hall (The Biometric Scanner)
- **Zero-Touch Check-in:** Students scan their private QR Dining Pass.
- **Sub-Second Face AI:** The tablet activates the camera, extracts a 128-d mathematical vector of the student's face, and verifies their identity against the database in `< 800ms`.
- **Fraud Prevention:** Checks for duplicate scans, rotating QR tokens, and liveness detection.

### ⚙️ For Administrators (The Dashboard)
- **Dynamic Meal Rates:** Admin enters the daily `Bazaar` cost; the system automatically calculates the per-meal rate and deducts it from the wallets of students who ate.
- **Financial Ledger:** Track all automated bKash deposits, approve refund requests, and manage dining periods.
- **Google Sheets Sync:** One-click export of monthly financial reports.

---

## 🏗️ System Architecture

The system utilizes a highly scalable, serverless **Three-Tier Architecture**:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT / EDGE LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Student  │  │  Admin   │  │ Dining   │  │ bKash SMS│  │ Google Sheets    │   │
│  │ Web App  │  │Dashboard │  │ Scanner  │  │ Forwarder│  │ (Data Export)    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘   │
│       └──────────────┴──────────────┴──────────────┴──────────────┘             │
│                                     │                                           │
│                          ┌──────────▼──────────┐                                │
│                          │    NEXT.JS EDGE     │  RBAC Auth, NextAuth v5,       │
│                          │    API GATEWAY      │  Rate Limiting, Zod Validation │
│                          └──────────┬───────────┘                               │
└─────────────────────────────────────┼───────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────────┐
│                             APPLICATION LOGIC                                   │
│  ┌────────────────┐ ┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ /api/wallet    │ │ /api/schedule │ │ /api/verify  │ │ /api/admin/bazaar   │  │
│  │ (Balance calc) │ │ (Meal toggle) │ │ (Face Match) │ │ (Rate Calculation)  │  │
│  └────────────────┘ └───────────────┘ └──────────────┘ └─────────────────────┘  │
└──────┬──────────────────┬──────────────────┬──────────────────┬─────────────────┘
       │                  │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐  ┌───────▼───────┐
│   WALLET    │  │  MEAL SCHEDULE  │  │  BIOMETRIC  │  │   OPERATIONS  │
│  PROCESSOR  │  │     MANAGER     │  │   ENGINE    │  │    ENGINE     │
│             │  │                 │  │             │  │               │
│ •Deposit    │  │ •Toggle Meals   │  │ •Parse 128-d│  │ •Bazaar Entry │
│ •Charge     │  │ •Cutoff Check   │  │ •Euclidean  │  │ •Dynamic Rate │
│ •Refund     │  │ •Auto-Suspend   │  │  Distance   │  │ •Reports      │
│ •Audit Log  │  │ •Bulk Updates   │  │ •Auth Token │  │ •User Roles   │
└──────┬──────┘  └────────┬────────┘  └──────┬──────┘  └───────┬───────┘
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │    PRISMA ORM DATA    │
                          │     ACCESS LAYER      │
                          │  •Type-safe Queries   │
                          │  •Connection Pooling  │
                          └───────────┬───────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
┌──────▼──────┐           ┌───────────▼───────────┐        ┌────────▼────────┐
│  AI MODELS  │           │   DATA PERSISTENCE    │        │  OBSERVABILITY  │
│  (Client)   │           │                       │        │                 │
│ •face-api.js│           │ •Neon PostgreSQL      │        │ •Vercel Logs    │
│ •TinyFace   │           │ •15 Relational Models │        │ •Prisma Metrics │
│ •MobileNetV1│           │ •B-Tree Indexes       │        │ •AuditLog Table │
│ •68-Points  │           │ •JSONB (Descriptors)  │        │ •NextAuth Audits│
└─────────────┘           └───────────────────────┘        └─────────────────┘
```

---

## 🗄️ Database Schema (15 Core Models)
Our PostgreSQL database is strictly normalized. Key relationships include:
- `User` 1:1 `Student` | 1:1 `Wallet`
- `Student` 1:N `MealSchedule` | 1:N `Transaction`
- `DiningPeriod` 1:N `Bazaar` | 1:N `MealRate`

*(A full ERD diagram is available in the documentation folder).*

---

## 💻 Local Setup Instructions

### 1. Prerequisites
- **Node.js:** 18.17 or later
- **PostgreSQL:** Remote (Neon.tech) or Local instance

### 2. Clone & Install
```bash
git clone https://github.com/Sushmoy-Nandi/niter_campus_dining.git
cd niter_campus_dining
npm install
```

### 3. Environment Variables
Copy the provided `.env.example` file to create your local `.env` file:
```bash
cp .env.example .env
```
Open the `.env` file and fill in the required credentials (e.g., your `DATABASE_URL`, `NEXTAUTH_SECRET`, and webhook keys). The `.env.example` file contains detailed instructions on how to acquire each key.

### 4. Database Initialization
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 5. Run the Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

**Default Admin Login:**
- Email: `admin@gmail.com`
- Password: `Admin123!`

---

## Future Roadmap (Beyond the Hackathon)

### Operations & Cost Optimization
1. **Food Waste AI:** Predict exact raw material needs based on historical schedules and feedback to aggressively minimize daily food waste.
2. **Smart Inventory:** Track real-time stock levels of bazaar products. Auto-flag low ingredients and generate smart procurement lists.
3. **AI Price Optimizer:** Analyze seasonal bazaar pricing trends to recommend the most cost-effective daily meal rate without dropping quality.
4. **Vendor Bidding Portal:** An automated portal where local NITER vendors and farmers bid on weekly raw material requirements, ensuring the lowest price.
5. **Auto Menu Generator:** AI creates weekly menus by cross-referencing student poll preferences with the cheapest current seasonal vegetables.

### Tech & Student Welfare
6. **IoT Smart Gates:** Move the Face AI from tablets to embedded edge devices (Raspberry Pi) at physical turnstiles for frictionless, walk-through entry.
7. **Smart Schedule Sync:** Integrate with NITER's academic routine to auto-suggest meal suspensions during exam weeks and university holidays.
8. **Nutrition Tracking:** Map daily menus to nutritional values so students can automatically track calorie and protein intake.
