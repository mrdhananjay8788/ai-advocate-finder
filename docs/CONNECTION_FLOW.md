# Client-Advocate Connection Flow

This document visualizes the state machine and privacy workflow governing how a Client connects with an Advocate.

## Privacy Guidelines
- **Before Acceptance (`PENDING`)**: 
  - The Advocate can see high-level case details (Case Type, Jurisdiction, Urgency) but **not** the raw transcript or structured summary.
  - The Client cannot see the Advocate's direct contact information.
- **After Acceptance (`ACCEPTED`)**:
  - The Advocate gains full access to the case details to proceed with the legal consultation.
  - The Client gains access to the Advocate's contact details.

## Sequence Diagram

```mermaid
sequenceDiagram
    actor Client
    participant Frontend
    participant Backend
    participant Database
    actor Advocate

    Client->>Frontend: Selects Advocate from Match List
    Frontend->>Backend: POST /connection-requests
    Backend->>Database: Verify case ownership & duplicates
    Database-->>Backend: Valid
    Backend->>Database: Create ConnectionRequest (PENDING)
    Backend-->>Frontend: Request created successfully

    Note over Advocate,Backend: Advocate reviews requests
    Advocate->>Frontend: View Pending Requests
    Frontend->>Backend: GET /connection-requests/advocate/me
    Backend->>Database: Query Advocate Requests
    Database-->>Backend: Returns PENDING requests (High-level Case info only)
    Backend-->>Frontend: Displays requests

    Advocate->>Frontend: Clicks "Accept Request"
    Frontend->>Backend: PATCH /connection-requests/:id/status (ACCEPTED)
    Backend->>Database: Update status to ACCEPTED
    Database-->>Backend: Updated
    Backend-->>Frontend: Success

    Note over Client,Advocate: Connection Established

    Client->>Frontend: View Connection Details
    Frontend->>Backend: GET /connection-requests/:id/details
    Backend->>Database: Fetch Details
    Database-->>Backend: (Returns Advocate Contact Info)
    Backend-->>Frontend: Displays Advocate Contact Info

    Advocate->>Frontend: View Full Case
    Frontend->>Backend: GET /connection-requests/:id/details
    Backend->>Database: Fetch Details
    Database-->>Backend: (Returns Full Case Transcript & Summary)
    Backend-->>Frontend: Displays Full Case
```

## Status Lifecycle
- **`PENDING`**: Initial state upon client request.
- **`ACCEPTED`**: Advocate agrees to consult. Exposes data to both parties.
- **`DECLINED`**: Advocate refuses the request. Terminates workflow.
- **`CANCELLED`**: Client retracts the request before advocate decides. Terminates workflow.
