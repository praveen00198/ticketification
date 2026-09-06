# Architecture Overview — QR Ticket Generation & Email Delivery System

## System Design
The application is structured as a **Modular Monolith** pairing a Node.js/Express TypeScript API with a React 18 / Vite TypeScript SPA.

```mermaid
flowchart TD
    Admin[Administrator Browser] --> Client[React SPA / Vite]
    Client --> API[Express REST API]
    API --> AuthModule[Auth Module]
    API --> GuestModule[Guest / Excel Module]
    API --> TicketModule[Ticket & PDF Engine]
    API --> VerifyModule[Scanner Verification Engine]
    
    TicketModule --> Resend[Resend Email API]
    TicketModule --> Puppeteer[Puppeteer PDF Generator]
    TicketModule --> QrGen[qrcode Library]
    
    AuthModule --> DB[(MongoDB Atlas / Local)]
    TicketModule --> DB
    VerifyModule --> DB
```

## Security & Environment Management
- Environment variables are isolated by component (`server/` vs `client/`).
- `server/src/config/env.ts` validates required variables on server startup and prevents missing configuration bugs in production.
- Secrets (`JWT_SECRET`, `RESEND_API_KEY`, `MONGODB_URI`) are strictly excluded from repository tracking via `.gitignore`.
