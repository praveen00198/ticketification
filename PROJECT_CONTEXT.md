# PROJECT_CONTEXT.md — Project Memory & Reconciled Status

## 1. Project Overview & Product Vision
**Product**: Ticketification  
**Identity**: Production-Grade Event Operating, Credential, and Access Platform  
**Architecture**: Modular Monolith with an **Infrastructure Triad**:
- **Authentication**: Supabase Auth (cryptographic JWT issuance & identity management)
- **Application Documents & RBAC**: MongoDB (users, events, event memberships, teams, evaluations, credential metadata, jobs, audit logs)
- **Object Storage**: Supabase Storage (PNG credentials, PDFs, templates, spreadsheets, ZIP archives)

Ticketification is **event-type aware** (supporting Hackathons, Conferences, Concerts, Festivals, Bootcamps, etc.) and uses a generic internal **Event Credential** abstraction with dynamic taxonomy (`Ticket`, `Participant Pass`, `Attendee Pass`, `Badge`).

---

## 2. Current Project State
```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: System Audit & Documentation Reconciliation ➔ COMPLETED       │
│ Phase 1: Authentication + Authorization Foundation ➔ CURRENT / READY   │
│ Phases 2–19: Host Platform & Operational Features ➔ PLANNED           │
│ Phases 20–21: Attendee Portal & Interactive Public Platform ➔ FUTURE   │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Implementation Status**:
> Documentation and Architecture Reconciliation is **COMPLETE**.
> Feature implementation for Phase 1 has **NOT STARTED** and awaits explicit user instruction.

---

## 3. Technology Stack & Target Architecture
| Layer | Current Codebase Implementation | Reconciled Target Architecture |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, html5-qrcode | React 18 SPA, context-aware Host console, Obsidian/Emerald design system |
| **Backend** | Node.js, Express, TypeScript (Modular Monolith) | Node.js / Express / TypeScript Modular Monolith with layered boundaries |
| **Authentication** | Supabase Auth (Defaulting all users to ADMIN — Security Flaw) | Supabase Auth (Default role `USER`; zero automatic admin privileges) |
| **Application DB & RBAC** | Supabase PostgreSQL via Drizzle ORM | **MongoDB** (Application profiles, event memberships, RBAC, teams, evaluations) |
| **Object Storage** | Supabase Storage (`ticket-images` bucket) | **Supabase Storage** (`/events/{eventId}/...` canonical hierarchy) |
| **Rendering Engine** | Sharp native rasterization (1620x2025 PNG binaries) | Sharp native rasterization (`sharp.cache(false)`, `concurrency(1)`, bundled Devanagari fonts) |
| **Check-In Concurrency** | Conditional SQL update on PostgreSQL | Atomic conditional update (`findOneAndUpdate` matching `{ status: 'ACTIVE' }`) |
| **Heavy Operations** | Synchronous HTTP endpoints & live streaming | Asynchronous background worker queue with progress tracking & presigned URLs |
| **Rate Limiting** | In-memory `Map<string, ClientRecord>()` | Distributed token-bucket rate limiting with endpoint-specific thresholds |

---

## 4. Architectural Boundaries & Domain Modules
```
server/src/modules/
├── auth/          # Supabase Auth integration, JWT verification, zero-trust middleware
├── users/         # Global user identity profiles & platform roles (USER, ADMIN, SUPER_ADMIN)
├── events/        # Event lifecycle engine, event-type configurations, institutional verification
├── members/       # Event-scoped memberships & RBAC (HOST, COORDINATOR, VOLUNTEER, MENTOR, EVALUATOR)
├── teams/         # Hackathon & competition teams, roster management, submission tracking
├── evaluation/    # Judging rubrics, blind scoring, evaluator workspaces, leaderboard rankings
├── credentials/   # Credential abstraction, Sharp template rendering, sequence numbering
├── checkin/       # Opaque QR token lookup, race-condition proof atomic check-in, worker passes
├── jobs/          # Asynchronous job queue for bulk credential generation, Excel import & ZIP export
├── audit/         # Immutable audit logging for administrative actions and score overrides
└── admin/         # Internal Platform Admin moderation, verification reviews & suspension controls
```

---

## 5. Non-Negotiable Source of Truth
All future development must reference the 9 core governance documents in the root directory:
1. `PRD.md` — Product Requirements Document
2. `ARCHITECTURE.md` — System Architecture & Layered Boundaries
3. `RULES.md` — Non-negotiable Engineering Rules & Invariants
4. `PHASES.md` — 22-Phase Roadmap & Phase Gate Matrix
5. `DESIGN.md` — Design System & Visual Specification
6. `MEMORY.md` — Institutional Knowledge & Hard-Won Production Lessons
7. `AGENTS.md` — Mandatory Agent Workflow & Invariants
8. `DECISION.md` — Architecture Decision Records (ADRs)
9. `TESTING.md` — Comprehensive Test Strategy & Verification Matrix
