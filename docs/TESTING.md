# Testing Documentation

This document outlines the testing strategies implemented in Phase 1 of the Advocate Finder platform.

## Test Categories

### 1. End-to-End (E2E) API & Authorization Tests
The project contains a comprehensive E2E test suite located in `backend/test/`. These tests simulate HTTP requests against the NestJS application using `supertest`. 

Because a live database is not always available in CI environments, the E2E suite utilizes **mocked Prisma schemas**. This allows us to guarantee that authentication guards, authorization decorators, controller routing, and state machine validations work flawlessly without needing a live PostgreSQL instance.

#### E2E Suites Implemented:
- `admin.e2e-spec.ts`: Tests Admin authorization and Verification status mutations.
- `advocates.e2e-spec.ts`: Tests Advocate profile updates and restrictions.
- `auth.e2e-spec.ts`: Tests Register and Login workflows, including password validation.
- `case-extraction.e2e-spec.ts`: Tests structured LLM payload formatting.
- `cases-security.e2e-spec.ts`: Tests strict Client ownership rules over Cases.
- `chatbot.e2e-spec.ts`: Tests AI Chatbot session initialization and message isolation.
- `connection-requests.e2e-spec.ts`: Tests the PENDING/ACCEPTED/DECLINED state machine and prevents privacy leaks.
- `matching.e2e-spec.ts`: Tests the ranking and querying logic for advocate suggestions.

#### How to Run E2E Tests:
Navigate to the backend directory and execute the test command:
```bash
cd backend
npm run test:e2e
```
*Expected Result:* 53 tests passing across 9 suites.

### 2. Build Verification
Build verification ensures that all TypeScript files are structurally sound and conform to strict compiler rules before deployment.

#### How to Run Build Verification:
**Backend**:
```bash
cd backend
npx prisma validate
npx prisma generate
npm run build
```

**Frontend**:
```bash
cd frontend
npm run build
```
*(Any TypeScript errors or missing imports will cause the build step to fail).*

## Future Testing Scope (Phase 2+)
- **Frontend Component Testing**: Add React Testing Library for verifying Next.js UI component behaviors.
- **Integration Testing**: Add Testcontainers to run tests against a live ephemeral PostgreSQL instance.
- **Unit Testing**: Add targeted Jest tests inside `backend/src/**/*.spec.ts` for deeply complex algorithms (e.g., the Advocate Matching heuristic) in isolation from the HTTP layer.
