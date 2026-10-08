# System Architecture

This document outlines the high-level architecture of the Advocate Finder platform.

## Architecture Diagram

```mermaid
flowchart TD
    ClientBrowser[Client Browser]
    
    subgraph Frontend [Next.js Frontend]
        NextApp[App Router UI]
        NextAPI[API Routes / Server Actions]
    end
    
    subgraph Backend [NestJS REST API]
        AuthGuard[JWT Auth Guard]
        RolesGuard[RBAC Guard]
        
        subgraph Modules [Business Modules]
            AuthM[Auth Module]
            ClientM[Client Module]
            AdvocateM[Advocate Module]
            CaseM[Case Module]
            ChatbotM[Chatbot Module]
            MatchingM[Matching Module]
            ConnM[Connection Requests Module]
            AdminM[Admin Module]
        end
        
        Prisma[Prisma ORM]
    end
    
    Database[(PostgreSQL Database)]
    LLM[OpenAI API (GPT-4o)]

    ClientBrowser <-->|HTTP/HTTPS| NextApp
    NextApp <-->|Fetch| NextAPI
    NextAPI <-->|REST / JSON| AuthGuard
    
    AuthGuard --> RolesGuard
    RolesGuard --> Modules
    
    ChatbotM <-->|REST| LLM
    
    Modules <-->|Prisma Client| Prisma
    Prisma <-->|TCP| Database
```

## Core Components

### 1. Frontend (Next.js)
The presentation layer is built with Next.js 16 utilizing the App Router.
- **Client-Side Rendering**: Used for highly interactive components (like the Chatbot interface).
- **Server-Side Rendering / Static Generation**: Used for public directory pages (Advocates list) and dashboard shells.
- **Tailwind CSS**: Used for rapid, utility-first styling.

### 2. Backend (NestJS)
A modular, monolithic REST API built on NestJS.
- **Controllers**: Handle incoming HTTP requests and validate input using `class-validator` DTOs.
- **Services**: Contain the core business logic (e.g., scoring advocates, parsing LLM responses).
- **Guards**: Intercept requests to enforce Authentication (JWT) and Authorization (Role-Based Access Control).

### 3. Database (PostgreSQL & Prisma)
- **PostgreSQL**: The relational database storing all persistent data.
- **Prisma**: The ORM used to interact with PostgreSQL. It provides a strongly-typed database client generated from `schema.prisma`.

### 4. External Services (OpenAI)
- **LLM API**: The `ChatbotModule` communicates with OpenAI to generate conversational responses for intake and to extract structured JSON data (Case Type, Jurisdiction, Urgency) from the unstructured chat transcript.

## Data Flow (Example: Case Intake)
1. User logs in (JWT stored in HTTP-Only Cookie or LocalStorage).
2. User talks to the chatbot via the Frontend.
3. Frontend sends messages to `POST /api/chatbot/:sessionId/message`.
4. Backend `ChatbotModule` communicates with OpenAI and returns the AI response.
5. When intake is complete, user requests case generation.
6. `CaseExtractionService` prompts OpenAI to parse the transcript into JSON.
7. `CaseModule` saves the structured `Case` via Prisma to PostgreSQL.
8. `MatchingModule` evaluates the new `Case` against available Advocates and generates `Match` records.
