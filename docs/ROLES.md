# Roles and Permissions

This document outlines the capabilities of each user role within the Advocate Finder platform.

## Available Roles
- **`CLIENT`**: The end-user seeking legal assistance.
- **`ADVOCATE`**: The legal professional offering services.
- **`ADMIN`**: Platform administrators who oversee the network.

## Permissions Matrix

| Feature / Action | Client | Advocate | Admin |
|------------------|--------|----------|-------|
| Login & Register | Yes | Yes | Yes |
| Manage Own Profile | Yes | Yes | Yes |
| Create a Case via Chatbot | Yes | No | No |
| View Own Cases | Yes | No | No |
| Match Advocates to Case | Yes | No | No |
| Search Public Advocate Directory | Yes | Yes | Yes |
| Send Connection Request | Yes | No | No |
| Cancel Connection Request | Yes | No | No |
| Accept/Decline Connection Request| No | Yes | No |
| View Own Connection Requests | Yes | Yes | No |
| View Full Case Transcripts | Yes (Owner) | Yes (If Accepted) | No |
| Verify Pending Advocates | No | No | Yes |
| View Platform Statistics | No | No | Yes |

*Note: Roles are strictly enforced at the backend via JWT token extraction and NestJS Guards (`@Roles()`). Unauthenticated access to protected actions results in a `401 Unauthorized`, and authenticated access by the wrong role results in a `403 Forbidden`.*
