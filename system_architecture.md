# NITER Campus Dining System — End-to-End System Architecture

This document outlines the complete, end-to-end architecture of the NITER Campus Dining System, from the client interfaces down to the database and external integrations.

---

## 1. High-Level Architecture Overview

The system follows a modern, serverless **Three-Tier Architecture**:
1. **Presentation Layer (Client):** React.js (Next.js App Router) for dynamic UI and client-side AI processing.
2. **Application Layer (Backend):** Next.js Serverless API Routes and Server Actions handling business logic, authentication, and validation.
3. **Data Layer (Database):** Neon (Serverless PostgreSQL) managed via Prisma ORM.

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

## 2. Component-Level Breakdown

### 2.1 The Client Layer (Frontend)
Built with **Next.js 14**, **React 18**, **Tailwind CSS**, and **shadcn/ui**.
- **Student Portal:** PWA-optimized interface for mobile phones. Students manage their meal schedules, view real-time digital wallet balances, and generate personal QR codes.
- **Admin Portal:** Desktop-optimized dashboard for managing users, approving bKash deposits, entering daily bazaar expenses, and downloading financial reports.
- **Scanner Tablet (Dining Hall Entrance):** A dedicated, locked-down UI that continuously scans for QR codes. Upon scanning, it activates the front-facing camera to perform biometric validation.

### 2.2 The Biometric AI Layer (Client-Side)
To ensure **maximum privacy and zero server latency**, the Facial Recognition pipeline operates entirely on the Scanner Tablet's hardware using WebGL.
1. **Camera Access:** WebRTC captures a live video feed.
2. **Detection Phase:** `face-api.js` utilizing `TinyFaceDetector` identifies the presence of a human face.
3. **Liveness & Alignment:** 68-point facial landmarks determine the yaw/pitch to prevent flat photo spoofing (students must turn their head left/right during enrollment).
4. **Extraction Phase:** The `SSD MobileNetV1` neural network extracts a 128-dimensional mathematical vector (Face Descriptor).
5. **Transmission:** Only this 128-d vector of numbers (never the image itself) is sent to the backend for verification.

### 2.3 The Application Layer (Next.js Backend)
Hosted on Vercel as Serverless Edge Functions.
- **NextAuth.js (v5):** Handles secure session management and Role-Based Access Control (RBAC). A student token cannot access the admin API, and an admin cannot access the scanner API.
- **Zod Validation:** All incoming data (meal schedules, deposit requests) is strictly validated against schemas before touching the database.
- **Business Logic Algorithms:** 
  - *Dynamic Pricing Engine:* Automatically divides the total daily `Bazaar` cost by the total `MealSchedules` for that day to compute the true `MealRate`.
  - *Auto-Suspension Guard:* Suspends a student's meal if their wallet balance drops below the required minimum deposit threshold.

### 2.4 The Data Layer (Database)
Hosted on Neon.tech (Serverless PostgreSQL).
- **Prisma ORM:** Provides type-safe database access and automated migrations.
- **Relational Integrity:** 15 highly normalized tables (Student, Wallet, Transaction, MealSchedule, DailyCharge, etc.) utilizing foreign keys and `ON DELETE CASCADE` to prevent orphaned data.
- **Concurrency Protection:** Ensures that multiple students checking in or depositing at the exact same millisecond do not cause race conditions on their wallet balances.

---

## 3. End-to-End Workflow Examples

### 3.1 The Deposit Flow (bKash Integration)
1. **Action:** Student sends money via bKash to the dining hall number.
2. **Webhook:** An Android SMS Forwarder app reads the incoming bKash SMS and POSTs the payload to `/api/bkash-webhook?secret=...`.
3. **Logging:** The backend parses the SMS, extracts the Transaction ID (TrxID) and amount, and saves it to the `BkashLedger` as "UNCLAIMED".
4. **Claiming:** The student enters the TrxID in their dashboard. The system verifies the ledger, marks it "CLAIMED", and credits their `Wallet`.

### 3.2 The Meal Check-In Flow (Dining Hall)
1. **Action:** Student holds their phone (showing their QR Code) up to the dining hall tablet.
2. **Decoding:** The tablet reads the encrypted JSON payload containing the `studentId`.
3. **Biometrics:** The tablet camera opens, detects the student's face in real-time, and extracts the 128-d vector.
4. **Verification API:** The tablet POSTs `{ studentId, faceDescriptor }` to `/api/scanner/verify`.
5. **Distance Calculation:** The backend retrieves the student's *enrolled* vector from PostgreSQL and calculates the Euclidean Distance against the *live* vector.
6. **Authorization:** If the distance is `< 0.45` and the student has sufficient balance, the server responds with a 200 OK. The meal is marked as consumed.

---

## 4. Security & Compliance

- **Password Hashing:** Passwords are mathematically hashed using `bcrypt` before storage.
- **Zero-Knowledge Biometrics:** Raw face images are never transmitted or stored, complying with modern data privacy standards.
- **Encrypted QR Codes:** QR codes rotate and contain signed tokens to prevent students from screenshotting and sharing them.
- **Immutable Audit Trail:** All critical actions (manual balance adjustments, admin overrides) are written to an `AuditLog` table that cannot be modified, ensuring full financial accountability.
