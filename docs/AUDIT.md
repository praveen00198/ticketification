# DEEP REPOSITORY AUDIT, SECURITY AUDIT & IMPLEMENTATION GAP ANALYSIS

**Document Version**: 2.0.0  
**Audit Date**: October 2026  
**Status**: COMPLETE  
**Repository**: `praveen00198/Ticketification`  

---

## 1. Executive Summary

A comprehensive, forensic audit of the **Ticketification** repository was conducted to evaluate the current codebase against the newly established product and architectural source of truth ([`PRD.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/PRD.md), [`ARCHITECTURE.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/ARCHITECTURE.md), [`RULES.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/RULES.md), [`PHASES.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/PHASES.md), [`DECISION.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/DECISION.md), and [`MEMORY.md`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/MEMORY.md)).

### Core Audit Discoveries:
1. **Critical Privilege Escalation Vulnerability**: Every user registered or authenticated through Supabase Auth is hardcoded to receive `role: 'ADMIN'` in both Supabase metadata and the application database. The frontend unconditionally displays the entire Admin Dashboard to any authenticated user.
2. **Missing Application Authorization Layer**: There is zero Role-Based Access Control (RBAC), no platform-level role model (`USER`, `ADMIN`, `SUPER_ADMIN`), and no event-scoped membership model (`event_members`).
3. **Severe IDOR Vulnerabilities**: Multiple endpoints (e.g. `GET /api/tickets/:id` and `GET /api/verify/recent/:eventId`) lack ownership or membership verification, permitting any authenticated user to inspect tickets or live check-in feeds belonging to other organizers.
4. **Database Architecture Divergence**: The current implementation runs exclusively on **Supabase PostgreSQL via Drizzle ORM**. **MongoDB is completely absent** from the repository (zero dependencies, zero connection logic, zero models). The target architecture mandates MongoDB for application documents, profiles, RBAC, teams, and evaluations.
5. **Synchronous Execution Bottlenecks**: Bulk credential generation (up to 50,000 items) and bulk ZIP archive exports run synchronously within standard Express HTTP request handlers, posing immediate gateway timeout and memory exhaustion risks.
6. **Ephemeral Local Storage Anti-Pattern**: The Excel import wizard writes uploaded spreadsheets to the local server filesystem (`uploads/staging-...`), which is wiped on cloud container restarts (Render).
7. **Production Resiliencies Working Well**: Native image rasterization using `sharp` (with disabled cache and bounded thread concurrency), bundled Devanagari fonts, opaque 64-character QR tokens, and PostgreSQL atomic check-in conditional updates are working reliably and pass all 132 automated tests.

---

## 2. Repository Structure & Workspace Topography

The workspace is organized as a decoupled monorepo:

```
Ticket/
├── .agents/                    # Agent skills & domain configurations
├── docs/                       # Technical subsystem specifications & audit logs
├── client/                     # Frontend SPA (React 18 / Vite / TypeScript)
│   ├── src/
│   │   ├── api/                # Axios API clients & interceptors
│   │   ├── components/         # Shared UI components & layout shells
│   │   ├── context/            # React context providers (EventContext)
│   │   ├── pages/              # 9 Page components
│   │   ├── types/              # Frontend TypeScript definitions
│   │   └── utils/              # Helper formatters & sound generators
│   ├── package.json            # Client dependencies & scripts
│   └── vite.config.ts          # Vite build config with Tailwind plugin
├── server/                     # Backend API (Node.js / Express / TypeScript)
│   ├── assets/                 # Canonical template PNG & bundled TTF fonts
│   ├── src/
│   │   ├── config/             # Environment & Supabase client initialization
│   │   ├── db/                 # Drizzle ORM schema (7 tables) & migrations
│   │   ├── middlewares/        # Auth, error, rate-limit, and upload middleware
│   │   ├── modules/            # 6 Domain modules (auth, events, guests, tickets, verify, dashboard)
│   │   └── utils/              # Memory logger, font initializer
│   ├── tests/                  # 13 Jest test suites (132 test cases)
│   ├── package.json            # Server dependencies & scripts
│   └── tsconfig.json           # Backend TypeScript compilation target
├── package.json                # Root proxy scripts
└── [Core Governance Docs]      # PRD.md, ARCHITECTURE.md, RULES.md, etc.
```

---

## 3. Technology Stack: Current vs. Target

| Architectural Layer | Actual Implementation in Codebase | Target Architecture (Source of Truth) | Status |
|---|---|---|---|
| **Frontend Framework** | React 18.3.1, Vite 5.3.3, TypeScript 5.5.3 | React 18 SPA with context-aware Host UI | **KEEP & EXPAND** |
| **Frontend Styling** | Tailwind CSS 3.4.4 / 4.3.3, Lucide React 0.400.0 | Obsidian/Emerald design tokens, Vanilla CSS / Tailwind | **MODIFY** |
| **Frontend Camera Scanner**| `html5-qrcode` 2.3.8 | Mobile-first web camera QR scanner | **KEEP** |
| **Backend Runtime** | Node.js 20+, Express 4.19.2, TypeScript 5.5.3 | Modular Monolith (Express / TypeScript) | **KEEP** |
| **Authentication** | Supabase Auth (`@supabase/supabase-js` 2.115.0) | Supabase Auth (JWT validation, passwords, OAuth) | **KEEP & HARDEN** |
| **Application Persistence** | **Supabase PostgreSQL via Drizzle ORM 0.39.0** | **MongoDB** (Profiles, RBAC, events, teams, evaluations) | **REPLACE / COEXIST** |
| **Object Storage** | Supabase Storage (`ticket-images` bucket, public) | Supabase Storage (`/events/{eventId}/...`, private) | **MODIFY** |
| **Image Rasterization** | Native `sharp` 0.35.4 (C++ libvips bindings) | Native `sharp` with Devanagari font embedding | **KEEP** |
| **Spreadsheet Ingestion** | `xlsx` 0.18.5 via local Multer disk storage | Direct presigned object upload + worker parser | **MODIFY** |
| **Archive Export** | `archiver` 7.0.1 (synchronous HTTP streaming) | Asynchronous background ZIP worker to storage | **REPLACE** |
| **Rate Limiter** | In-memory `Map<string, ClientRecord>()` | Distributed token-bucket rate limiter | **REPLACE** |
| **Background Processing** | Synchronous inside Express route handlers | Asynchronous job queue (`jobs`) with workers | **MISSING** |

---

## 4. Dependency Audit

### Server Dependencies (`server/package.json`)
- `@supabase/supabase-js` (`^2.115.0`): **CURRENTLY USED / CRITICAL**. Handles auth admin and storage client initialization.
- `drizzle-orm` (`^0.39.0`) & `drizzle-kit` (`^0.30.0`): **CURRENTLY USED / TEMPORARY**. Manages PostgreSQL schema.
- `postgres` (`^3.4.5`): **CURRENTLY USED**. PostgreSQL connection driver.
- `sharp` (`^0.35.4`): **CURRENTLY USED / CRITICAL**. High-performance PNG rasterization engine.
- `puppeteer` (`^22.13.0`): **UNUSED / RISKY / DEAD WEIGHT**. Leftover from legacy SVG rasterizer. Downloads heavy Chromium binaries (~300MB) during build; completely uncalled in runtime code. **RECOMMENDATION: REMOVE**.
- `xlsx` (`^0.18.5`): **CURRENTLY USED / REQUIRED**. Parses Excel workbooks.
- `archiver` (`^7.0.1`): **CURRENTLY USED**. Creates ZIP archives.
- `qrcode` (`^1.5.3`): **CURRENTLY USED / CRITICAL**. Generates QR matrices.
- `cors` (`^2.8.5`), `dotenv` (`^16.4.5`), `express` (`^4.19.2`), `multer` (`^1.4.5-lts.1`): Standard infrastructure.

### Client Dependencies (`client/package.json`)
- `axios` (`^1.7.2`): **CURRENTLY USED / REQUIRED**. HTTP client.
- `html5-qrcode` (`^2.3.8`): **CURRENTLY USED / CRITICAL**. Camera barcode scanner.
- `jszip` (`^3.10.1`): **CURRENTLY USED**. Client-side ZIP utility.
- `lucide-react` (`^0.400.0`): **CURRENTLY USED**. Icon library.
- `qrcode` (`^1.5.4`): **CURRENTLY USED**. Client preview QR rendering.
- `react` (`^18.3.1`) & `react-router-dom` (`^6.24.1`): Core UI and routing.

---

## 5. Environment Variable Audit

| Variable Name | Purpose | Used By | Required? | Exposure Level | Audit Finding |
|---|---|---|---|---|---|
| `NODE_ENV` | Environment switch | Server | Yes | Server-only | Properly handled. |
| `PORT` | HTTP server port (default 5000) | Server | Yes | Server-only | Properly handled. |
| `APP_URL` | Frontend origin for CORS & QR URLs | Server | Yes | Server-only | Defaults to `http://localhost:5173`. |
| `DATABASE_URL` | PostgreSQL connection pooler string | Server | Yes | Server-only | Secret. Used by Drizzle. Missing Mongo URI. |
| `SUPABASE_URL` | Supabase project API gateway | Server & Client | Yes | Public / Server | Shared correctly. |
| `SUPABASE_ANON_KEY` | Supabase public anon key | Server & Client | Yes | Public / Server | Shared correctly. |
| `SUPABASE_SERVICE_ROLE_KEY` | Master administrative secret | Server only | Yes | **SERVER ONLY** | Kept on server; isolated from client bundle. |
| `SUPABASE_STORAGE_BUCKET`| Target bucket (`ticket-images`) | Server | Yes | Server-only | Defaults to `ticket-images`. |
| `UPLOAD_DIR` | Local disk upload staging folder | Server | Optional | Server-only | Anti-pattern on ephemeral hosts. |
| `PUPPETEER_HEADLESS` | Legacy browser flag | Server | No | Server-only | Obsolete dead variable. |
| `VITE_API_URL` | Backend API base address | Client | Yes | Public bundle | Handled via Vite client build. |
| `VITE_SUPABASE_URL` | Client Supabase URL | Client | Yes | Public bundle | Handled correctly. |
| `VITE_SUPABASE_ANON_KEY`| Client Supabase Anon Key | Client | Yes | Public bundle | Handled correctly. |

---

## 6. Authentication Audit

### 6.1 Registration Flow (`POST /api/auth/register`)
- **Location**: [`server/src/modules/auth/services/auth.service.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/auth/services/auth.service.ts#L15-L87).
- **Execution**: Calls `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role: 'ADMIN' } })`.
- **Finding**: Automatically confirms email (`email_confirm: true`) and stamps `role: 'ADMIN'` into user metadata.
- **Database Sync**: Upserts profile into PostgreSQL `users` with `role: 'ADMIN'`.
- **Session**: Automatically invokes `authClient.auth.signInWithPassword` and returns an active JWT session token to the caller.

### 6.2 Login Flow (`POST /api/auth/login`)
- **Location**: [`server/src/modules/auth/services/auth.service.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/auth/services/auth.service.ts#L89-L149).
- **Execution**: Calls `supabasePublic.auth.signInWithPassword({ email, password })`.
- **Profile Upsert**: Reads `user.user_metadata?.role || 'ADMIN'` and upserts PostgreSQL user record with role `'ADMIN'`.
- **Token Delivery**: Returns `{ user: { id, name, email, role: 'ADMIN' }, token }`.

### 6.3 Token Handling & Middleware (`auth.middleware.ts`)
- **Location**: [`server/src/middlewares/auth.middleware.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/auth.middleware.ts).
- **Verification**: Extracts `Authorization: Bearer <token>`, validates token cryptographically against Supabase Auth via `supabaseAdmin.auth.getUser(token)`.
- **Attachment**: Attaches `req.user = { id: user.id, email: user.email, role: user.user_metadata?.role || 'ADMIN' }`.
- **Finding**: Correctly checks token expiration and signature (returns 401 on invalid/expired token), but propagates the flawed `ADMIN` role.

---

## 7. Critical Authorization & Security Audit

### 7.1 The Admin Privilege Escalation Flaw
```
Client Register / Login
         │
         ▼
Supabase Auth creates user with user_metadata: { role: 'ADMIN' }
         │
         ▼
Backend stores user in public.users with role = 'ADMIN'
         │
         ▼
Frontend receives JWT and stores in localStorage('admin_token')
         │
         ▼
Frontend App.tsx evaluates { token && user } ➔ Unlocks ALL Admin Routes
         │
         ▼
Backend APIs enforce ZERO Platform Role checks (Any valid JWT succeeds)
```
- **Severity**: **CRITICAL (P0)**.
- **Mechanism**: The backend treats every authenticated human as an Administrator. There is no concept of a regular attendee or user who cannot access administrative endpoints.

### 7.2 Authorization Matrix (Code Analysis of Current Endpoints)

| Test Authorization Case | Code Check Path | Actual Status in Code | Risk Level |
|---|---|---|---|
| **Normal USER ➔ Admin Dashboard API** | `requireAdmin` checks server-controlled DB `role` | **REMEDIATED (PROTECTED - Phase 1)** | Low |
| **Normal USER ➔ Super Admin Operations** | `requireSuperAdmin` checks server-controlled DB `role` | **REMEDIATED (PROTECTED - Phase 1)** | Low |
| **User A ➔ User B's Event Details** | `eventService.getEventById` checks `createdBy !== userId` | **PROTECTED** | Low |
| **User A ➔ User B's Ticket by ID** | `ticketService.getTicketByIdForOwner` checks `event.createdBy === userId` | **REMEDIATED (PROTECTED - Phase 1)** | Low |
| **User A ➔ User B's Live Check-In Feed** | `verificationService.getRecentCheckins` checks `event.createdBy === userId` | **REMEDIATED (PROTECTED - Phase 1)** | Low |
| **Volunteer ➔ Host Settings** | Roles not isolated; volunteer has full admin privileges | **PLANNED (Phase 2 RBAC)** | High |
| **Volunteer ➔ Credential Generation** | `generateTickets` checks only event ownership (`createdBy`) | **PARTIALLY PROTECTED**| Medium |
| **Coordinator ➔ Event Deletion** | No coordinator role exists; only creator can delete | **PROTECTED (BY ABSENCE)** | Low |
| **Evaluator ➔ Blind Judging Scores** | No evaluation system exists in codebase | **MISSING** | N/A |
| **Suspended User ➔ Authenticated APIs** | Profile lookup in DB fails closed | **PARTIALLY PROTECTED** | Medium |
| **Suspended Event ➔ Registration / Ticketing** | Event status checks | **PLANNED (Phase 2)** | Medium |

---

## 8. Data Models & Database Architecture Audit

### 8.1 Current Relational Schema (PostgreSQL via Drizzle ORM)
- `users`: `(id [UUID], name, email, role, created_at, updated_at)`
  - *Finding*: Hardcoded default `role = 'ADMIN'`. Missing phone, avatar, platform roles.
- `events`: `(id [UUID], name, date, time, venue, description, organizer_name, logo_url, ticket_template_url, status, created_by, created_at, updated_at)`
  - *Finding*: Missing `eventType`, `credentialTerminology`, `registrationMode`, `isPaid`, `capacity`, and institutional verification fields.
- `ticket_types`: `(id, event_id, name, label, usage_policy, created_at)`
  - *Finding*: Correctly supports extensible ticket categories (`VIP`, `GUEST`, `WORKER`).
- `guests`: `(id, event_id, name, email, phone, organization, designation, category, metadata, import_id, created_at, updated_at)`
  - *Finding*: Supports arbitrary JSONB metadata and unassigned worker records.
- `tickets`: `(id, event_id, guest_id, ticket_type_id, verification_token, status, usage_policy, asset_path, asset_url, sequence_number, created_by, created_at, updated_at)`
  - *Finding*: Has compound unique index on `(event_id, sequence_number)` and unique index on `verification_token`.
- `ticket_checkins`: `(id, ticket_id, event_id, checked_in_at, verified_by, worker_name_assigned, metadata)`
  - *Finding*: Correctly stores check-in history for reusable passes.
- `guest_imports`: `(id, event_id, file_name, total_rows, valid_rows, invalid_rows, skipped_rows, column_mapping, required_fields, category_mapping, status, error_report, created_by, created_at)`
  - *Finding*: Tracks multi-step Excel wizard state.

### 8.2 Missing Target Collections (MongoDB)
The following target document collections required by the target architecture are **completely missing**:
1. `users` (Target MongoDB schema with `supabaseUserId`, `platformRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN'`)
2. `event_members` (Event-scoped RBAC: `HOST`, `COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR` with custom permission arrays)
3. `teams` & `team_members` (Hackathon & competition rosters)
4. `evaluations` (Blind scoring rubrics, evaluator criteria weights, and scorecards)
5. `jobs` (Asynchronous worker queue for bulk generation, imports, and exports)
6. `audit_logs` (Immutable administrative audit trail)
7. `institutions` (College / university directory and verification records)

---

## 9. Subsystem Audits

### 9.1 Credential & Ticket Generation Engine
- **Engine**: [`server/src/modules/tickets/services/ticket-image.service.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/tickets/services/ticket-image.service.ts).
- **Status**: **WORKING / REUSABLE**.
- **Mechanics**: Generates QR code via `qrcode.toDataURL()`, builds SVG overlay, embeds base64 Devanagari font (`NotoSansDevanagari-Bold.ttf`), and composites overlay onto preloaded background template PNG using native `sharp` in ~15ms.
- **Header Check**: Strictly validates genuine PNG binary format (`0x89504E47`) via `isPngBuffer()`.
- **Memory Bounding**: Configured with `sharp.cache(false)` and `sharp.concurrency(1)` to prevent Render 512MB RAM OOM crashes.
- **Gap**: Generation is hardcoded around the word "Ticket" instead of the generic "Event Credential" abstraction.

### 9.2 QR Generation & Verification
- **Token Generation**: Cryptographically secure 64-character hexadecimal tokens generated via `crypto.randomBytes(32).toString('hex')`.
- **QR Payload**: Encodes `https://ticketification.app/verify/<TOKEN>`. **Zero attendee PII encoded**.
- **Check-In Atomicity**: [`server/src/modules/tickets/repositories/ticket.repository.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/tickets/repositories/ticket.repository.ts#L247-L258) executes `UPDATE tickets SET status = 'USED' WHERE id = $1 AND status = 'ACTIVE' RETURNING *`.
- **Concurrency Test**: Verified in automated tests ([`tests/verificationAtomic.test.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/tests/verificationAtomic.test.ts)); 5 simultaneous scans result in exactly 1 `VALID` and 4 `ALREADY_USED`.

### 9.3 Bulk Operations & Background Processing
- **Bulk Credential Generation**:
  - Located in `TicketService.generateTicketsForEvent()`.
  - **Executes synchronously** inside Express HTTP request handler.
  - Queries up to 50,000 guests, loops in batches of 2, renders PNGs, and uploads to Supabase Storage sequentially.
  - **Verdict**: **REPLACE with asynchronous job worker**.
- **Bulk ZIP Export**:
  - Located in `TicketService.streamTicketsZip()`.
  - **Executes synchronously** by piping Archiver stream directly to Express `res`.
  - Downloads every PNG from Supabase Storage in batches of 10 and appends to the live HTTP response.
  - **Verdict**: **REPLACE with asynchronous background export job**.

### 9.4 Excel Import Engine
- **Wizard**: 5-step interactive workflow (Upload ➔ Analyze Headers ➔ Column Mapping ➔ Validation Preview ➔ Commit).
- **Header Matching**: Dynamic header confidence scoring; handles arbitrary column orders; optional phone and email supported.
- **Storage Anti-Pattern**: Uploaded files written to `uploads/staging-...` on server disk.
- **Verdict**: **MODIFY to use direct Supabase Storage presigned upload**.

### 9.5 Storage Architecture & Bucket Permissions
- **Service**: `SupabaseStorageService`.
- **Bucket**: `ticket-images`.
- **Hierarchy**: `events/{eventId}/tickets/{filename}.png`.
- **Vulnerability**: Bucket is initialized with `public: true`. All generated passes are crawlable and downloadable by anyone who discovers or guesses the storage key.
- **Target**: Private bucket with presigned URLs.

### 9.6 Rate Limiting Subsystem
- **Implementation**: [`server/src/middlewares/rate-limit.middleware.ts`](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/rate-limit.middleware.ts).
- **Architecture**: In-memory `Map<string, ClientRecord>()` with a 60-second sweep interval.
- **Limitations**: Ineffective across multi-container instances; completely resets on every Render container restart.
- **Target**: Distributed token-bucket rate limiter.

### 9.7 Frontend Architecture & Dashboard Pages
- **Routing**: React Router DOM (`/`, `/events`, `/events/:eventId`, `/import`, `/tickets`, `/scan`, `/verify/:token`).
- **State Management**: Simple React `useState` and `EventContext` backed by `localStorage`.
- **API Client**: Axios instance in `client/src/api/client.ts` with request interceptor attaching `admin_token`.
- **Missing Interfaces**: No Host team/staff management, no mentor workspace, no judging rubrics/scorecards, no platform admin console, no background job monitoring.

---

## 10. API Route Inventory & Security Audit Table

| Method | Endpoint | Auth Required | Platform Role Checked? | Event Scoping Checked? | Rate Limited? | Idempotent? | Audit Logged? | Security & Architectural Status |
|---|---|---|---|---|---|---|---|---|
| `POST` | `/api/auth/register` | No | No (Assigns ADMIN) | N/A | Yes (30/15m) | No | No | **CRITICAL SECURITY RISK** (Escalation) |
| `POST` | `/api/auth/login` | No | No | N/A | Yes (30/15m) | Yes | No | **PARTIALLY PROTECTED** (Elevates to Admin) |
| `POST` | `/api/auth/logout` | No | No | N/A | No | Yes | No | **BENIGN** |
| `GET` | `/api/auth/me` | Yes | No | N/A | No | Yes | No | **PARTIALLY PROTECTED** |
| `POST` | `/api/auth/change-password` | Yes | No | N/A | No | No | No | **PROTECTED** (Supabase admin update) |
| `GET` | `/api/events` | Yes | No | User-owned | No | Yes | No | **PROTECTED** (Filters `createdBy`) |
| `POST` | `/api/events` | Yes | No | Sets `createdBy` | No | No | No | **PROTECTED** |
| `GET` | `/api/events/:eventId` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `PUT` | `/api/events/:eventId` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `DELETE` | `/api/events/:eventId` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `GET` | `/api/events/:eventId/ticket-types`| Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `POST` | `/api/events/:eventId/ticket-types`| Yes | No | `createdBy` check | No | No | No | **PROTECTED** |
| `GET` | `/api/guests/events/:eventId` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `POST` | `/api/guests/events/:eventId` | Yes | No | `createdBy` check | No | No | No | **PROTECTED** |
| `POST` | `/api/guests/events/:eventId/upload`| Yes | No | `createdBy` check | No | No | No | **RISKY** (Ephemeral disk write) |
| `POST` | `/api/guests/events/:eventId/validate`| Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `POST` | `/api/guests/events/:eventId/confirm` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `POST` | `/api/tickets/events/:eventId/generate`| Yes | No | `createdBy` check | No | Yes (skips) | No | **BOTTLENECK** (Synchronous HTTP) |
| `GET` | `/api/tickets/events/:eventId/export-zip`| Yes | No | `createdBy` check | No | Yes | No | **BOTTLENECK** (Synchronous streaming) |
| `GET` | `/api/tickets/events/:eventId` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `GET` | `/api/tickets/:id` | **Yes** | **No** | **NONE** | **No** | **Yes** | **No** | **CRITICAL IDOR VULNERABILITY** |
| `GET` | `/api/tickets/:id/download` | Yes | No | `createdBy` check | No | Yes | No | **PROTECTED** |
| `POST` | `/api/verify/scan` | Yes | No | Event match | Yes (180/min)| Yes | Partial | **WORKING** (Atomic conditional update) |
| `GET` | `/api/verify/recent/:eventId` | **Yes** | **No** | **NONE** | **Yes** | **Yes** | **No** | **CRITICAL IDOR VULNERABILITY** |
| `GET` | `/api/dashboard/stats` | Yes | No | Buggy query | No | Yes | No | **BROKEN** (`userId` passed as `eventId`) |

---

## 11. Technical Debt Inventory

### Critical Severity
1. **Universal Admin Escalation**: Default `role: 'ADMIN'` assignment in `auth.service.ts` and `auth.middleware.ts`.
2. **Direct IDOR on Ticket Details**: `ticketController.getTicketById` returns ticket records without verifying that the requester owns or belongs to the event.
3. **Direct IDOR on Recent Check-In Feed**: `verificationController.getRecentCheckins` returns live scanner feeds for any `eventId` without verifying requester membership.

### High Severity
4. **Complete Absence of MongoDB**: Target document database is not installed or configured.
5. **Synchronous Bulk Generation**: 10,000+ tickets generated inside HTTP request handler.
6. **Synchronous Bulk ZIP Streaming**: Bulk downloads streamed through Node memory.
7. **Ephemeral Local Disk Writes**: Excel import wizard writes staging files to local server disk (`uploads/staging-...`).

### Medium Severity
8. **In-Memory Rate Limiting**: In-memory `Map` resets on deployment and fails across multiple instances.
9. **Public Supabase Storage Bucket**: Ticket images are stored in a public bucket (`ticket-images`) rather than private storage with signed URLs.
10. **Dashboard Controller Parameter Bug**: `dashboardController.getStats` passes `userId` where `eventId` is expected, resulting in zeroed statistics.
11. **Unused Puppeteer Dependency**: `puppeteer` remains in `server/package.json`, causing 300MB+ unnecessary download overhead during deployment.

---

## 12. Component Classification Matrix

```
KEEP / MODIFY / REPLACE / REMOVE / DEFER / MISSING
```

| Component / Subsystem | Current State | Classification | Rationale & Recommended Action |
|---|---|---|---|
| **Sharp Ticket Rasterizer** | Native C++ libvips PNG generator | **KEEP** | Fast (~15ms), container-safe, handles Devanagari fonts cleanly. |
| **QR Code Cryptography** | 64-char crypto tokens via randomBytes | **KEEP** | Opaque, secure, zero PII encoded. |
| **Single-Step Check-In Logic** | Atomic conditional SQL update | **KEEP** | Race-condition proof, verified in concurrency tests. |
| **Excel Header Analyzer** | Dynamic mapping & confidence scoring | **KEEP** | Highly resilient to varied spreadsheet formats. |
| **Supabase Auth Integration** | JWT issuance & verification | **MODIFY** | Keep provider; remove automatic `ADMIN` role assignment. |
| **Guest Import Pipeline** | Uploads to local server disk | **MODIFY** | Switch from local disk to direct Supabase Storage upload. |
| **Rate Limiting Engine** | In-memory sliding window Map | **MODIFY** | Upgrade to distributed token-bucket rate limiting. |
| **Supabase Storage Engine** | Public `ticket-images` bucket | **MODIFY** | Convert to private bucket with signed URLs. |
| **Application Database Layer** | Supabase PostgreSQL + Drizzle ORM | **REPLACE (PHASED)**| Introduce MongoDB in Phase 2; run coexistence before cutover. |
| **Bulk Ticket Generation** | Synchronous HTTP execution | **REPLACE** | Refactor into asynchronous background job queue. |
| **Bulk ZIP Export** | Synchronous Node streaming | **REPLACE** | Refactor into background export worker saving to storage. |
| **Puppeteer Dependency** | Present in `server/package.json` | **REMOVE** | Completely dead code; sharp is used exclusively. |
| **Legacy Disk Upload Routes** | `/uploads/tickets/:filename` | **REMOVE** | Obsolete local file redirect handlers in `app.ts`. |
| **WhatsApp Delivery Integration**| Documented in docs/ | **DEFER** | Out of scope for current Host focus. |
| **Attendee Self-Service Portal** | Not implemented | **DEFER** | Scheduled for Phase 20. |
| **Interactive Public Directory** | Basic landing only | **DEFER** | Scheduled for Phase 21. |
| **MongoDB Connection & Models** | Not present | **MISSING** | Required for Phase 2 application identity. |
| **Platform Roles (`USER`/`ADMIN`)**| Not present | **MISSING** | Required for Phase 1 zero-trust foundation. |
| **Event Membership RBAC** | Not present | **MISSING** | Required for Phase 7 staff management. |
| **Teams & Judging Module** | Not present | **MISSING** | Required for Phase 10–11 hackathons. |
| **Background Job Engine** | Not present | **MISSING** | Required for Phase 15 bulk operations. |
| **Immutable Audit Logging** | Not present | **MISSING** | Required for Phase 18 security. |

---

## 13. Gap Matrix

| Requirement | Current Implementation | Target State | Gap Analysis | Severity | Classification | Dependencies |
|---|---|---|---|---|---|---|
| **Zero-Trust Auth** | Everyone is `ADMIN` | Default `USER`; backend RBAC | Complete lack of authorization enforcement | **CRITICAL** | **MODIFY** | None |
| **IDOR Protection** | Ticket & recent check-in open | Strict membership & ownership check | Arbitrary object inspection possible | **CRITICAL** | **MODIFY** | Auth fix |
| **Application DB** | Supabase PostgreSQL | MongoDB | MongoDB driver & models completely absent | **HIGH** | **REPLACE** | Phase 2 |
| **Staff Roles** | Creator check only | `event_members` granular RBAC | Cannot invite volunteers/coordinators | **HIGH** | **MISSING** | Event model |
| **Bulk Generation** | Synchronous HTTP | Async Worker Queue (`jobs`) | HTTP timeouts on 1,000+ records | **HIGH** | **REPLACE** | Jobs engine |
| **Bulk ZIP Export** | Synchronous Node stream | Async Worker to Supabase Storage | High server bandwidth and timeout risk | **HIGH** | **REPLACE** | Jobs engine |
| **Spreadsheet Upload**| Local disk staging | Direct presigned storage upload | Ephemeral disk loss on Render | **MEDIUM** | **MODIFY** | Supabase Storage |
| **Storage Privacy** | Public bucket | Private bucket + signed URLs | Crawlable ticket passes | **MEDIUM** | **MODIFY** | Storage config |
| **Hackathon Teams** | Absent | Event-scoped teams & rubrics | Cannot support competitions/hackathons | **MEDIUM** | **MISSING** | Event model |
| **Distributed Rate Limit**| In-memory Map | Distributed token-bucket | Resets on restart; multi-instance leak | **LOW** | **MODIFY** | Redis/DB store |

---

## 14. Implementation Dependency Graph

```
                                [Phase 0: Audit & Reconciliation] (COMPLETED)
                                                       │
                                                       ▼
                       [Phase 1: Authentication & Authorization Foundation]
                         - Eliminate automatic ADMIN role elevation
                         - Introduce platform roles (USER, ADMIN, SUPER_ADMIN)
                         - Fix IDOR in ticket and verification endpoints
                                                       │
                                                       ▼
                        [Phase 2: MongoDB Application Identity Architecture]
                         - Connect MongoDB alongside PostgreSQL
                         - Create User model & profile synchronization
                                                       │
                                                       ▼
                              [Phase 3: Host Identity & Onboarding]
                                                       │
                                                       ▼
                                    [Phase 4: Event Creation]
                                     - Event-type awareness
                                     - Custom credential terminology
                                                       │
                                                       ▼
                              [Phase 5: Event Verification & Risk Engine]
                                                       │
                                                       ▼
                                    [Phase 6: Event Lifecycle Engine]
                                                       │
                                                       ▼
                              [Phase 7: Event Membership & Scoped RBAC]
                               - event_members collection
                               - Secure email token invitations
                                                       │
                         ┌─────────────────────────────┴─────────────────────────────┐
                         ▼                                                           ▼
         [Phase 8: Staff Management]                                  [Phase 10: Team Management]
         - Coordinators & Volunteers                                  - Hackathon rosters
                         │                                                           │
                         ▼                                                           ▼
         [Phase 14: QR Scanner RBAC]                                  [Phase 11: Evaluation Engine]
         - SCAN_CREDENTIALS check                                     - Blind judging rubrics
                         │                                                           │
                         └─────────────────────────────┬─────────────────────────────┘
                                                       │
                                                       ▼
                                     [Phase 12: Credential Architecture]
                                                       │
                                                       ▼
                                     [Phase 13: Credential Templates]
                                                       │
                                                       ▼
                              [Phase 15: Asynchronous Import & Bulk Jobs]
                               - Direct presigned storage uploads
                               - Background worker queue
                                                       │
                                                       ▼
                                         [Phase 16: Export Jobs]
                                                       │
                                                       ▼
                              [Phase 17: Storage & Performance Hardening]
                                                       │
                                                       ▼
                                    [Phase 18: Security & Audit Logging]
                                                       │
                                                       ▼
                                    [Phase 19: Context-Aware Host UI]
```

---

## 15. Migration Plan (Current ➔ Target)

### Step 1: Fix Security & Authorization Boundary (Phase 1)
- **Action**: In `auth.service.ts` and `auth.middleware.ts`, eliminate hardcoded `ADMIN` assignments. Set default role to `USER`. Add middleware to guard platform admin endpoints.
- **Action**: Fix IDOR vulnerabilities in `ticket.controller.ts` (`getTicketById`) and `verification.controller.ts` (`getRecentCheckins`) by asserting event ownership.
- **Risk**: Low.
- **Data Migration**: None.

### Step 2: Provision MongoDB & Application Identity (Phase 2)
- **Action**: Add `mongoose` or `mongodb` driver. Establish MongoDB connection pool.
- **Action**: Create `User` schema matching the target model. On user login/sync, create corresponding document in MongoDB.
- **Risk**: Low. Existing PostgreSQL database remains untouched.
- **Data Migration**: One-time background script syncing existing PostgreSQL `users` to MongoDB.

### Step 3: Implement Event Models & Scoped Memberships (Phases 3–7)
- **Action**: Implement MongoDB `events` and `event_members` collections.
- **Action**: Move event creation and authorization lookups to check `event_members`.
- **Risk**: Medium. Requires maintaining dual-read or migration script for existing events.

### Step 4: Refactor Heavy Operations into Background Workers (Phases 15–16)
- **Action**: Implement `jobs` collection.
- **Action**: Refactor `generateTicketsForEvent` and `streamTicketsZip` to execute via background queue.
- **Action**: Implement presigned upload URLs for Excel spreadsheets.
- **Risk**: Low. Greatly improves stability and eliminates timeouts.

---

## 16. Security Priority Action Plan

### P0 — Immediate Security Blockers
1. **Remove Automatic Admin Role Assignment**: In `auth.service.ts` line 29, change `user_metadata: { role: 'ADMIN' }` to `role: 'USER'`. In line 53, change `role: 'ADMIN'` to `'USER'`. In `auth.middleware.ts`, reject unverified roles.
2. **Patch IDOR in Ticket Retrieval**: In `ticket.controller.ts` line 76, enforce ownership check on `getTicketById`.
3. **Patch IDOR in Live Check-in Feed**: In `verification.controller.ts` line 75, verify event ownership before returning `getRecentCheckins`.

### P1 — High Priority
4. **Enforce Backend Role Verification**: Ensure no frontend route can access administrative APIs without an explicit platform `ADMIN` role verified from database records.
5. **Private Supabase Storage Bucket**: Set `ticket-images` bucket to private and generate signed URLs for credential downloads.

### P2 — Important
6. **Eliminate Ephemeral Disk Writes**: Replace local disk upload in `guest-import.service.ts` with direct presigned uploads to Supabase Storage.
7. **Introduce Distributed Rate Limiter**: Replace in-memory `Map` rate limiter with persistent/distributed rate limiting.

### P3 — Hardening
8. **Prune Dead Dependencies**: Remove `puppeteer` from `server/package.json`.
9. **Fix Dashboard Controller Parameter**: Pass correct `eventId` in `dashboardController.getStats`.

---

## 17. Open Architectural Questions

1. **Dual-Database Coexistence Duration**: How long should PostgreSQL run alongside MongoDB before full cutover? *(Recommendation: Complete transition across Phases 2–12, then archive PostgreSQL schemas).*
2. **Job Queue Engine Choice**: For the asynchronous worker pool, should we use a lightweight MongoDB-backed job collection (zero added infrastructure dependencies) or Redis/BullMQ? *(Recommendation: MongoDB-backed collection to keep operational complexity and hosting costs minimal on Render).*
3. **Payment Gateway Provider**: Which payment gateway should be targeted for Phase 6+ paid events (Razorpay for India / Stripe for International)?

---

## 18. Machine-Readable Summary

```yaml
audit:
  status: complete
  timestamp: "2026-10-08T16:30:00Z"
  auditor: Antigravity Senior Engineering Agent

architecture:
  current: modular_monolith_relational
  target: modular_monolith_triad
  drift_level: high

authentication:
  status: working
  provider: supabase_auth
  flaw: automatic_admin_elevation

authorization:
  backend_enforced: false
  status: vulnerable
  role_model: flawed_global_admin

database:
  current_primary: supabase_postgresql_drizzle
  target_primary: mongodb
  mongo_installed: false
  postgresql_tables_count: 7

storage:
  provider: supabase_storage
  bucket_status: public
  target_bucket_status: private_signed_urls

admin_security:
  status: vulnerable
  reason: all_authenticated_users_receive_admin_role

event_isolation:
  status: partial
  idor_vulnerabilities_found:
    - "/api/tickets/:id"
    - "/api/verify/recent/:eventId"

bulk_generation:
  architecture: synchronous_http
  target_architecture: background_worker_jobs
  memory_safety_on_render_512mb: safe_in_batches_of_2_but_http_timeout_risk

qr_checkin:
  atomic: true
  concurrency_safe: true
  token_format: opaque_64_hex
  pii_encoded: false

rate_limiting:
  distributed: false
  mechanism: in_memory_sliding_window_map

dependencies:
  dead_weight:
    - puppeteer

test_suite:
  total_suites: 13
  total_tests: 132
  passing: 132
  failing: 0

migration:
  complexity: medium
  strategy: phased_dual_database_coexistence

implementation_ready: false
blocker: awaiting_review_of_audit_report
```
