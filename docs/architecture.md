# Architecture Overview — Ticketification Platform

## 1. System Design & Topography
Ticketification is structured as a **Modular Monolith** pairing a Node.js/Express TypeScript backend with a React 18 / Vite TypeScript frontend, governed by an **Infrastructure Triad**:
- **Authentication**: Supabase Auth (cryptographic JWT issuance)
- **Application Documents & RBAC**: MongoDB (users, events, event memberships, teams, evaluations, credential metadata, jobs, audit logs)
- **Object Storage**: Supabase Storage (PNG credentials, PDFs, templates, spreadsheets, ZIP archives)

```mermaid
flowchart TD
    Client[React SPA / Mobile Scanner] --> API[Express REST API]
    API --> AuthMW[Supabase JWT Middleware]
    AuthMW --> RBAC[Authorization Guard - MongoDB]
    
    RBAC --> EventMod[Event & Lifecycle Module]
    RBAC --> MemberMod[Team & Staff Membership Module]
    RBAC --> EvalMod[Evaluation & Scoring Module]
    RBAC --> CredMod[Credential & Template Engine]
    RBAC --> CheckinMod[Atomic Check-In & Scanner Engine]
    RBAC --> JobMod[Asynchronous Worker Queue]
    
    CredMod --> SharpEngine[Native Sharp Rasterizer]
    CredMod --> SupaStorage[Supabase Storage]
    JobMod --> SupaStorage
    
    EventMod --> MongoDB[(MongoDB Application DB)]
    MemberMod --> MongoDB
    EvalMod --> MongoDB
    CredMod --> MongoDB
    CheckinMod --> MongoDB
    JobMod --> MongoDB
```

For complete architecture specifications, see [ARCHITECTURE.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/ARCHITECTURE.md).
