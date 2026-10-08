# Deployment Preparation

This document outlines the architecture, environment configurations, and checklists required to deploy the Advocate Finder platform to a production environment. 

**Note: The application is currently marked as DEVELOPMENT READY, but has NOT been fully audited for production compliance (e.g., GDPR, Bar Association Advertising Rules).**

## Deployment Architecture
A recommended standard deployment would separate concerns as follows:
- **Frontend**: Next.js App Router deployed to Vercel or AWS Amplify.
- **Backend**: NestJS application deployed to a managed container service (e.g., AWS Fargate, Render, or Railway) or a traditional VPS.
- **Database**: Managed PostgreSQL instance (e.g., AWS RDS, Supabase, Neon).

## Build Commands
When running in CI/CD pipelines, execute:

**Backend:**
```bash
cd backend
npm install
npx prisma generate
npm run build
```
*(The backend build artifacts will be placed in `backend/dist`)*

**Frontend:**
```bash
cd frontend
npm install
npm run build
```
*(The frontend build will generate a `.next` folder optimized for production)*

## Environment Variables
The following environment variables **MUST** be populated in production:

### Backend
- `DATABASE_URL`: Connection string to the managed PostgreSQL DB.
- `JWT_SECRET`: A strong, randomly generated secret (do not use the fallback string).
- `OPENAI_API_KEY`: API Key for the LLM.

### Frontend
- `NEXT_PUBLIC_API_URL`: The production URL pointing to the NestJS backend (e.g., `https://api.advocatefinder.example.com`).

## Production Readiness Checklist
Before going live, ensure the following steps are complete:
- [ ] **Strong JWT Secret**: Ensure `JWT_SECRET` is at least 32 characters long.
- [ ] **Secure HTTPS**: Enforce SSL/TLS for both the Frontend and Backend servers.
- [ ] **CORS Configuration**: Update `app.enableCors()` in `backend/src/main.ts` to strictly allow only the production frontend URL (instead of wildcard `*`).
- [ ] **Environment Secrets**: Ensure `.env` files are not checked into source control (they are gitignored by default).
- [ ] **Database Migrations**: Run `npx prisma migrate deploy` in production to apply migrations safely. Do NOT run `prisma db push` or `prisma migrate reset` in production.
- [ ] **Seed Data Disabled**: Do not execute `npm run seed` in production to avoid cluttering the system with fictional demo accounts.
- [ ] **Logging & Error Monitoring**: Implement robust logging (e.g., Winston) and an error tracker (e.g., Sentry).
- [ ] **Backups**: Configure automated backups for the PostgreSQL instance.
