# Troubleshooting Guide

This document lists common issues you might encounter while developing or running the Advocate Finder platform locally.

### Prisma cannot connect
**Symptom**: `PrismaClientInitializationError: Can't reach database server at 'localhost:5432'`
**Fix**:
1. Ensure your PostgreSQL instance is actively running.
2. Check that the `DATABASE_URL` in `backend/.env` is correct. The default expectation is `postgresql://USER:PASSWORD@localhost:5432/advocate_finder`.

### Prisma Client error / Unknown Types
**Symptom**: TypeScript complains that `CaseType`, `Role`, or other Prisma models do not exist.
**Fix**:
The Prisma Client is out of sync with your `schema.prisma`. Run the following command in the `backend/` directory:
```bash
npx prisma generate
```

### Migration error
**Symptom**: Prisma complains about schema drift or failed migrations when running `npx prisma migrate dev`.
**Fix**:
1. Ensure no manual changes were made directly in the PostgreSQL database bypassing Prisma.
2. If working locally and the data is dispensable, you can force a schema sync via `npx prisma db push`.
*Note: Do NOT run `prisma migrate reset` in production.*

### Backend cannot start
**Symptom**: Running `npm run dev` in the backend crashes immediately.
**Fix**:
1. Ensure you have run `npm install`.
2. Check that `.env` is populated with `JWT_SECRET`.
3. Check for port conflicts. NestJS runs on port `3001` by default.

### Frontend cannot connect to backend
**Symptom**: The frontend starts, but logins fail with `Network Error` or `Failed to fetch`.
**Fix**:
1. Verify the backend is running.
2. Verify `NEXT_PUBLIC_API_URL` is set to `http://localhost:3001/api` in `frontend/.env.local`.
3. If deployed, check `app.enableCors()` in the backend `main.ts` to ensure the production frontend domain is permitted.

### AI Chatbot responds with Errors
**Symptom**: Chat sessions fail to generate responses.
**Fix**:
1. Check that `OPENAI_API_KEY` is present and valid in `backend/.env`.
2. Check your OpenAI account for quota limitations or rate limits.
