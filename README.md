# AI-Powered Advocate Finder Platform

## Overview

The Advocate Finder platform is a dedicated web application designed to help clients describe a legal issue, structure relevant case information, and discover suitable legal advocates. 

**Disclaimer:** The AI system built into this platform is strictly for case intake, classification, and advocate matching support. **It does NOT provide legal advice or guarantee outcomes.**

## Key Features

- **Multi-Role Authentication**: JWT-based authentication for Clients, Advocates, and Admins.
- **Role-Based Access Control (RBAC)**: Strict API isolation protecting client data, case information, and advocate profiles.
- **Client & Advocate Profiles**: Dedicated profiles tailored to legal details, jurisdiction, and bar registration.
- **AI-Powered Case Intake**: A conversational AI chatbot that assists clients in structuring their initial legal problem.
- **Structured Case Extraction**: Automatically parses unstructured chatbot transcripts into structured legal categories (Case Type, Urgency, Jurisdiction, etc.) using LLM APIs.
- **Advocate Matching**: A rule-based scoring engine that recommends verified advocates to clients based on matching case characteristics.
- **Connection Requests**: A secure, state-based workflow (PENDING -> ACCEPTED / DECLINED) allowing clients to initiate contact with advocates, preserving privacy until both parties agree.
- **Admin Verification**: Administrative tools to review and approve/verify advocate registrations.
- **Seed/Demo Data**: Built-in CLI commands to seed the platform with demo accounts and fake data for testing.

## Technology Stack

**Frontend**:
- Next.js 16 (App Router)
- React
- TypeScript
- Tailwind CSS

**Backend**:
- NestJS
- TypeScript
- Prisma ORM

**Database**:
- PostgreSQL

**Other**:
- JWT for authentication
- OpenAI API (for chatbot and case extraction)

## Project Structure

```
mini_project/
├── backend/                  # NestJS API Backend
│   ├── src/                  
│   │   ├── admin/            # Admin workflows & verification
│   │   ├── advocates/        # Advocate profile management
│   │   ├── auth/             # JWT Auth, Register, Login
│   │   ├── cases/            # Case management and privacy
│   │   ├── chatbot/          # AI Chat session management
│   │   ├── clients/          # Client profile management
│   │   ├── connection-requests/ # Client-Advocate connection state machine
│   │   └── matching/         # Advocate matching and scoring engine
│   ├── prisma/               # Schema and Database Seed
│   └── package.json
│
├── frontend/                 # Next.js UI
│   ├── src/app/              
│   │   ├── admin/            # Admin Dashboard
│   │   ├── advocate/         # Advocate Dashboard
│   │   ├── client/           # Client Dashboard
│   │   ├── advocates/        # Public Advocate Directory
│   │   ├── login/            # Auth UI
│   │   ├── register/         # Registration UI
│   │   └── how-it-works/     # Platform info
│   ├── src/components/       # Reusable React components
│   └── package.json
│
├── docs/                     # Comprehensive Architecture & API Documentation
└── README.md
```

## Local Setup Guide

### Prerequisites
- Node.js (v20+ recommended)
- npm
- PostgreSQL database (or access to a managed Postgres instance)

### Setup Steps
1. Clone the project repository.
2. Navigate to `backend` and create a `.env` file based on `.env.example`.
3. Configure the `DATABASE_URL`, `JWT_SECRET`, and `OPENAI_API_KEY` in the backend `.env`.
4. Run `npm install` in the `backend/` directory.
5. Run `npx prisma validate` and `npx prisma generate` in the backend.
6. Run `npx prisma db push` to push the schema to your database (or `npx prisma migrate dev`).
7. Run `npm run seed` to populate demo data.
8. Start the backend: `npm run dev` in the `backend/` directory.
9. Navigate to `frontend/` and run `npm install`.
10. Start the frontend: `npm run dev` in the `frontend/` directory.

### Demo Credentials
If you ran the seed script, you can log in with:
- **Admin**: `admin@advocatefinder.local` / `Password123!`
- **Client**: `client@advocatefinder.local` / `Password123!`
- **Advocate**: `advocate1@advocatefinder.local` / `Password123!`

For more details on API, Architecture, and Security, please see the `docs/` folder.
