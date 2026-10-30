# Smart Adv Assistance for Legal Case — LexisMatch AI

**B.Tech Major Project — Group ID: 30**

---

## 1. Overview

**LexisMatch AI** is an intelligent, multi-role legal-tech web application designed to bridge the gap between citizens facing legal challenges and verified legal advocates. The platform combines a structured AI intake assistant, algorithmic advocate matching, and privacy-preserving connection management.

> [!IMPORTANT]
> **Legal Boundary & AI Safety:** The integrated AI assistant strictly performs conversational case intake, fact extraction, and case classification. **It does NOT provide legal advice, suggest litigation strategy, or predict judicial outcomes.**

---

## 2. Key Features by Role

### 👤 Client Workflow
- **Direct Registration & Authentication**: Secure registration and JWT-based authentication.
- **AI Case Intake Chatbot**: Interactive conversational intake that gathers facts while maintaining clear legal disclaimers.
- **Structured Case Profile Extraction**: Extracts legal domain (Property, Criminal, Civil, Family, Corporate, etc.), jurisdiction, urgency level, case stage, and factual summary.
- **Profile Review & Confirmation**: Clients review, edit, and confirm extracted case details before matching.
- **Advocate Recommendation Engine**: Generates 0–100 scored matches based on specialization (40 pts), jurisdiction (20 pts), language (10 pts), experience (10 pts), budget (10 pts), and availability (10 pts).
- **Connection Requests**: Clients send connection requests to matched advocates with customized initial messages.
- **Real-Time Tracking**: Clients monitor request status (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`).

### ⚖️ Advocate Portal
- **Advocate Profile Management**: Manage practice areas, court admissions, bar registration number, bio, fee range, and experience.
- **Availability Toggle**: One-click status switch (`AVAILABLE` / `UNAVAILABLE`) dynamically factored into matching algorithms.
- **Incoming Leads & Connection Requests**: Review incoming connection requests with case summaries and urgency tags.
- **Accept / Decline Actions**: Accept requests to exchange direct contact information or decline gracefully.

### 🛡️ Platform Admin (Ops Console)
- **Platform Analytics Overview**: Real-time database metrics for total clients, registered advocates, verified advocates, pending verifications, total cases, and connection requests.
- **Advocate Verification Management**: Review submitted bar registration credentials and verify or reject advocate applications.
- **Client & Case Oversight**: Inspect cases, matching records, and compliance audit logs.
- **Reviews & Ratings Audit**: Moderate ratings and reviews.

### 🌐 Multilingual Accessibility
- Full user interface support in **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)** via a persistent language context with instant switching.

---

## 3. Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide/Heroicons SVG.
- **Backend**: NestJS 11, Node.js, TypeScript, Passport.js, JWT, bcrypt.
- **Database**: SQLite (via Prisma ORM 6).
- **AI Integration**: Google Gemini API (`@google/genai`) with offline test-safe mock fallbacks.
- **Testing**: Jest, Supertest (15 unit test suites, 10 e2e workflow suites).

---

## 4. Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Environment Configuration

Copy the example environment file for the backend:
```bash
cp backend/.env.example backend/.env
```

Ensure `backend/.env` has the following minimum variables:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secure-jwt-secret-key"
GEMINI_API_KEY="" # Optional: Real Gemini API key (safe mock fallback used if blank)
```

Ensure `frontend/.env.local` contains:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Database Migration & Prisma Setup

From the `backend/` directory:
```bash
# Push schema changes to SQLite database without deleting existing data
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 3. Start Backend API Server
```bash
cd backend
npm run build
node dist/src/main.js
# API running at http://localhost:3001
```

### 4. Start Frontend Web Server
```bash
cd frontend
npm run dev
# Web application running at http://localhost:3000
```

---

## 5. Demo Credentials

If using the seeded database records:
- **Admin**: `admin@advocatefinder.local` / `Password123!`
- **Client**: `client@advocatefinder.local` / `Password123!`
- **Advocate**: `advocate1@advocatefinder.local` / `Password123!`

---

## 6. Running Automated Tests

```bash
# Run backend unit tests (all 8 suites):
cd backend
npm test

# Run backend end-to-end integration tests (all 10 suites including full workflow):
cd backend
npm run test:e2e

# Run frontend production build check:
cd frontend
npm run build
```

---

## 7. Known Limitations & Roadmap

1. **Email & Mobile SMS OTP**: Postponed for future release; infrastructure and database models are prepared for SMTP and SMS gateway credentials.
2. **Document Uploads**: Cloud storage bucket integration for legal documents is planned for Phase 2.
3. **Real-Time WebSockets**: Currently polling/REST is used for status updates; WebSocket notifications are planned for Phase 2.
