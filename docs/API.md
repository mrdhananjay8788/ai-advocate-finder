# API Documentation

This document summarizes the core backend endpoints implemented in the NestJS REST API. All endpoints are prefixed with `/api`.

---

## 1. AUTH

### POST `/auth/register`
- **Authentication**: Public
- **Description**: Register a new User and their corresponding Profile (Client/Advocate).
- **Body**: `{ email, password, role, name, ...profileFields }`
- **Response**: `{ id, email, role }`

### POST `/auth/login`
- **Authentication**: Public
- **Description**: Authenticate and receive a JWT.
- **Body**: `{ email, password }`
- **Response**: `{ accessToken, user }`

---

## 2. CLIENT

### GET `/clients/me`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Fetch the profile of the currently logged-in client.
- **Response**: `{ id, name, city, cases: [] }`

### PATCH `/clients/me`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Update client profile details.

---

## 3. ADVOCATE

### GET `/advocates`
- **Authentication**: Public
- **Description**: List all verified advocates. (Can be filtered by query parameters).

### GET `/advocates/:id`
- **Authentication**: Public
- **Description**: Fetch public details of a specific advocate.

### GET `/advocates/me`
- **Authentication**: Required (Role: `ADVOCATE`)
- **Description**: Fetch the logged-in advocate's private profile.

### PATCH `/advocates/me`
- **Authentication**: Required (Role: `ADVOCATE`)
- **Description**: Update availability, practice areas, languages, etc.

---

## 4. CASE

### POST `/cases`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Create a new structured legal case.
- **Body**: `{ caseType, jurisdiction, urgencyLevel, caseStage, rawTranscript, budgetRange? }`

### GET `/cases`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: List all cases owned by the logged-in client.

### GET `/cases/:id`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Get specific case details. Security guards ensure only the owner can view this.

### PATCH `/cases/:id`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Update a specific case.

---

## 5. CHATBOT

### POST `/chatbot/start`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Start a new AI intake chat session.
- **Response**: `{ sessionId }`

### POST `/chatbot/:sessionId/message`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Send a message to the AI and receive a response.
- **Body**: `{ content: string }`

### POST `/chatbot/:sessionId/extract-case`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Instructs the LLM to parse the session's transcript and generate a structured JSON object representing the legal case.

---

## 6. MATCHING

### GET `/matching/case/:caseId`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Get ranked advocate suggestions for a specific case. Only the case owner can invoke this.
- **Response**: `[{ advocateId, matchScore, status }, ...]`

---

## 7. CONNECTION REQUESTS

### POST `/connection-requests`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Client initiates a connection request to an Advocate.
- **Body**: `{ caseId, advocateId, clientMessage }`

### GET `/connection-requests/client/me`
- **Authentication**: Required (Role: `CLIENT`)
- **Description**: Get all requests sent by the logged-in client.

### GET `/connection-requests/advocate/me`
- **Authentication**: Required (Role: `ADVOCATE`)
- **Description**: Get all requests received by the logged-in advocate.

### PATCH `/connection-requests/:id/status`
- **Authentication**: Required (Role: `ADVOCATE` or `CLIENT`)
- **Description**: Update the status (`ACCEPTED`, `DECLINED`, `CANCELLED`). Rules apply: Advocates can only Accept/Decline. Clients can only Cancel.

### GET `/connection-requests/:id/details`
- **Authentication**: Required (Role: `ADVOCATE` or `CLIENT`)
- **Description**: Only allows access to full case details (for advocate) or advocate contact info (for client) IF the request status is `ACCEPTED`.

---

## 8. ADMIN

### GET `/admin/overview`
- **Authentication**: Required (Role: `ADMIN`)
- **Description**: Get platform statistics (total clients, advocates, active cases).

### GET `/admin/advocates/pending`
- **Authentication**: Required (Role: `ADMIN`)
- **Description**: Get a list of advocates awaiting verification.

### PATCH `/admin/advocates/:id/verification`
- **Authentication**: Required (Role: `ADMIN`)
- **Description**: Update an advocate's `verifiedStatus` to `VERIFIED` or `REJECTED`.
