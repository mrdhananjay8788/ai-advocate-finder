# Security & Access Control

This document outlines the security controls implemented in the NestJS backend.

## 1. Authentication
- **JWT (JSON Web Tokens)**: All protected routes require a valid JWT passed in the `Authorization: Bearer <token>` header.
- **Password Hashing**: User passwords are encrypted using `bcrypt` before storage. Plain-text passwords are never stored or logged.
- **Environment Secrets**: The `JWT_SECRET` is loaded from `.env`. The codebase defaults to a fallback secret in development but **must** be overridden in production.

## 2. Role-Based Access Control (RBAC)
We enforce role isolation using a custom `@Roles()` decorator and `RolesGuard` in NestJS.

- **`CLIENT`**: Can only access client-specific endpoints (e.g., `/cases`, `/clients/me`, `/chatbot`).
- **`ADVOCATE`**: Can only access advocate-specific endpoints (e.g., `/advocates/me`).
- **`ADMIN`**: Can access verification and overview endpoints. Admin routes strictly reject `CLIENT` and `ADVOCATE` tokens.

## 3. Data Ownership & Isolation
Frontend route protection is not the only security layer. The backend strictly isolates data:
- **Case Privacy**: When a client fetches `/cases/:id`, the backend verifies that the `clientId` on the case matches the ID embedded in the requesting user's JWT. Attempts to access cases owned by others result in a `403 Forbidden`.
- **Profile Privacy**: Advocates can only modify their own availability and profile parameters.
- **Connection Privacy**: Advocate contact details and full Client case transcripts are locked behind a state-machine. They are only exposed via `/api/connection-requests/:id/details` IF the connection status is `ACCEPTED`.

## 4. Input Validation
All incoming HTTP requests are validated against DTOs using `class-validator` via NestJS's `ValidationPipe(whitelist: true)`. This strips unexpected fields and validates ENUM constraints, preventing injection of invalid states.
