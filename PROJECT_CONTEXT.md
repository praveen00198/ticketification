# PROJECT_CONTEXT.md — Project Memory & Reconciled Status

## 1. Project Overview & Product Vision
**Product**: Ticketification  
**Identity**: Production-Grade Event Operating, Credential, and Access Platform  
**Target Direction**: Serves normal registered users who can discover and attend events and, whenever they choose, organize and manage their own events. Attending and organizing are equally important core capabilities. Single global user identity supporting multiple concurrent relationships across events.

**Architecture**: Modular Monolith with an **Infrastructure Triad**:
- **Authentication**: Supabase Auth (cryptographic JWT issuance & identity management)
- **Application Documents & RBAC**: MongoDB (users, events, event memberships, teams, evaluations, credential metadata, jobs, audit logs)
- **Object Storage**: Supabase Storage (PNG credentials, PDFs, templates, spreadsheets, ZIP archives)

Ticketification is **event-type aware** (supporting Hackathons, Conferences, Concerts, Festivals, Bootcamps, etc.) and uses a generic internal **Event Credential** abstraction with dynamic taxonomy (`Ticket`, `Participant Pass`, `Attendee Pass`, `Badge`).

---

## 2. Current Project State
```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: System Audit & Documentation Alignment ➔ VERIFIED COMPLETE    │
│ Phases 1–19: Core Platform Engine & Operational Features ➔ VERIFIED    │
│ Phase 20: Attendee Experience Platform ➔ ACTIVE / CORE VERIFIED        │
│ Phase 21: Public Discovery & Verification ➔ ACTIVE / CORE VERIFIED     │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Implementation & Verification Status**:
> - All 34 automated server test suites (393 tests) pass cleanly.
> - Both client (`tsc && vite build`) and server (`tsc`) production builds succeed.
> - Auto-admin escalation vulnerability in legacy event creation is remediated and covered with regression tests.
> - Client-side navigation in `App.tsx` correctly uses React Router SPA navigation.
> - Visual design aligns to a light, clean, distinctive interface with restrained emerald/mint accents.

---

## 3. Technology Stack & Current Verified Architecture
| Layer | Current Codebase Implementation | Verified Target Architecture |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, html5-qrcode | React 18 SPA, client-side routing, light & clean design system |
| **Backend** | Node.js, Express, TypeScript (Modular Monolith) | Node.js / Express / TypeScript Modular Monolith with layered boundaries |
| **Authentication** | Supabase Auth (Default role `USER`; zero automatic admin privileges) | Supabase Auth (Default role `USER`; verified zero auto-admin elevation) |
| **Application DB & RBAC** | MongoDB (Application profiles, event memberships, RBAC, teams, evaluations) | **MongoDB** (Application profiles, event memberships, RBAC, teams, evaluations) |
| **Object Storage** | Supabase Storage (`ticket-images` bucket / canonical hierarchy) | **Supabase Storage** (`/events/{eventId}/...` canonical hierarchy) |
| **Rendering Engine** | Sharp native rasterization (1620x2025 PNG binaries) | Sharp native rasterization (`sharp.cache(false)`, `concurrency(1)`, bundled Devanagari fonts) |
| **Check-In Concurrency** | Atomic conditional update (`findOneAndUpdate` matching `{ status: 'ACTIVE' }`) | Atomic conditional update (`findOneAndUpdate` matching `{ status: 'ACTIVE' }`) |
| **Heavy Operations** | Asynchronous background worker queue with progress tracking & presigned URLs | Asynchronous background worker queue with progress tracking & presigned URLs |
| **Rate Limiting** | Distributed token-bucket rate limiting with endpoint-specific thresholds | Distributed token-bucket rate limiting with endpoint-specific thresholds |

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
