# Phase 1 Scope Boundary

This document explicitly defines what is included in Phase 1 (MVP) of the Advocate Finder platform and what has been deferred to future phases. It serves to align expectations regarding platform capabilities.

## IN SCOPE (Implemented in Phase 1)

1. **Core Infrastructure**
   - NestJS REST API with modular architecture.
   - Next.js (App Router) Frontend.
   - PostgreSQL Database via Prisma ORM.

2. **Authentication & Authorization**
   - JWT-based Auth.
   - Strict Role-Based Access Control (RBAC) separating `CLIENT`, `ADVOCATE`, and `ADMIN`.

3. **User Profiles**
   - Dedicated profiles for Clients (Basic info).
   - Dedicated profiles for Advocates (Bar Reg, Specializations, Fees, Ratings).
   - Admin verification mechanism for new Advocates.

4. **AI-Powered Intake & Extraction**
   - Chatbot interface for clients to describe their legal problems.
   - Prompt-engineered LLM integration (OpenAI API).
   - Automatic extraction of unstructured transcripts into structured `Case` objects (Type, Urgency, Jurisdiction, etc.).

5. **Advocate Matching Engine**
   - A synchronous, heuristic rule-based scoring engine comparing `Case` objects against verified, available `Advocates`.
   - Scoring prioritizes specialization (35%) and jurisdiction (20%).

6. **Connection Request Workflow**
   - A secure, multi-state workflow (`PENDING` -> `ACCEPTED` / `DECLINED` / `CANCELLED`).
   - Privacy-first approach: conceals full case transcripts from Advocates and Advocate contact info from Clients until a mutual connection is accepted.

7. **Basic Dashboards**
   - Client Dashboard (Cases, Chats, Connection status).
   - Advocate Dashboard (Profile management, Incoming connection requests).
   - Admin Dashboard (Platform stats, Verification queue).

## OUT OF SCOPE (Deferred to Phase 2+)

The following features were explicitly excluded from Phase 1 to ensure a stable, focused MVP delivery. These are not present in the codebase.

1. **Real-time In-App Messaging**: There is no direct WebSocket chat between connected Clients and Advocates. Connection currently implies off-platform follow-up via exposed contact details.
2. **Payments & Escrow**: The platform does not handle financial transactions, retainers, or lead credits.
3. **Video Consultations**: No WebRTC or Zoom integrations exist.
4. **Subscription Plans**: The platform has no SaaS tiering or premium advocate placements.
5. **Advanced ML Analytics**: Matching is strictly heuristic/rule-based, not based on ML semantic similarity vectors.
6. **WhatsApp Integration**: Notifications are local to the platform; no external SMS/WhatsApp webhooks are implemented.
7. **Document Uploads**: Case intake relies purely on text via the Chatbot. The ability to upload FIRs or Notices (PDF/Image) is deferred.
