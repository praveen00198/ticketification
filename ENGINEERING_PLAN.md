# Ticketification — Autonomous Engineering Plan & Stabilization Living Document

**Last Updated**: 2026-10-27  
**Governance**: Gravitas Reliability Runtime  
**Lead Agent**: Antigravity Autonomous Engineering Agent  
**Status**: ACTIVE EXECUTION  

---

## 1. Context & Verification Baseline

### 1.1 Verified Ground Truth
1. **Technology Stack**:
   - **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Axios, html5-qrcode.
   - **Backend**: Node.js, Express, TypeScript, Sharp (libvips), Mongoose 9.11, Archiver, xlsx, Resend.
   - **Authoritative Database**: MongoDB (Mongoose models in `server/src/db/mongo/models/`).
   - **Storage**: Supabase S3-compatible Object Storage (`ticket-images`) for badge PNG assets.
   - **Legacy Database**: PostgreSQL / Drizzle ORM (under staged deprecation).

2. **Verified Clean Baseline**:
   - `git status`: Clean working tree on `main`.
   - `npm --prefix client run build`: **PASSED** (0 errors, 55.73s).
   - `npm --prefix server run build`: **PASSED** (0 errors).
   - `eventSwitcherBehaviorRegression.test.ts` & `eventLifecycleAuditFixes.test.ts`: **32/32 PASSED** (100% PASS).

3. **Core Invariants & Boundaries**:
   - **Triad Identity**: Global User Workspace, Host Workspace, and Event-Specific Attendee Workspace.
   - **Zero-Trust Backend**: Roles and permissions are event-scoped in `event_members`. Never trust frontend state or localStorage.
   - **Storage Isolation**: Structured documents in MongoDB; PNG badges and assets exclusively in Supabase Storage.
   - **Atomic Gate Turnstile**: Double check-in prevention via atomic conditional updates (`status === 'ACTIVE'`).

---

## 2. Engineering Backlog & Defect Inventory

| ID | Domain / Component | Defect / Architectural Gap | Root Cause | Severity | Status | Verification Criteria |
|---|---|---|---|---|---|---|
| **DEF-01** | `auth` / `tests` | 4 test suites failing (49 tests) in `eventStaffManagement`, `eventMemberRbac`, `eventCredentialArchitecture`, `eventTeamManagement`. | Tests passed raw mock token strings (`valid-host-token-phase8`) instead of signed custom JWTs (`createJwtToken`). `authMiddleware` rejected them with 401. | **HIGH** | **Verified** | All 11 event test suites pass (177 tests total, 100% green). |
| **DEF-02** | `dashboard` / `server` | `DashboardService` directly queries Drizzle `tickets` table with `sql<number>count(*)::int`. Fails or returns 0/500 when `DATABASE_URL` is unset or data is in MongoDB. | Legacy Drizzle queries not updated to query MongoDB `EventModel` and `EventCredentialModel`. | **HIGH** | In Progress | Unit & API tests verify `getDashboardStats` accurately returns MongoDB stats and recent credentials. |
| **DEF-03** | `audit` / `server` | `AuditService.record()` logs warning `Cannot call audit_logs.insertOne() before initial connection is complete if bufferCommands = false`. | `AuditService` attempts write when `mongoose.connection.readyState !== 1` without pre-check. | **MEDIUM** | **Verified** | Guard added for `mongoose.connection.readyState !== 1`; verified 0 warnings. |
| **DEF-04** | `tickets` / `server` | Synchronous bulk badge rendering risk on `/api/tickets/generate` for >50 records. | Legacy endpoint lacks automatic delegation or guard rails to `eventJobQueueService`. | **HIGH** | Planned | Requests for >50 badges automatically dispatch asynchronous background job or reject synchronous execution. |
| **DEF-05** | `guests` / `tickets` | Dual-database repositories in `guest.repository.ts` and `ticket.repository.ts` coexisting with MongoDB models. | Incomplete deprecation of Drizzle tables. | **MEDIUM** | Planned | All active routes use Mongo repositories with clean fallback handling. |
| **DEF-06** | `navigation` / `client` | Edge-case workspace switcher transitions when clearing active event context. | Host context needs deterministic transition back to Global User Dashboard when leaving event. | **MEDIUM** | Planned | Browser workflow verifies navigation between Global, Host, and Attendee workspaces without stale context. |

---

## 3. Work Batches & Execution Phases

### Batch 1: Test Suite Token Modernization & RBAC Test Fixes (DEF-01, DEF-03)
- **Objective**: Modernize test tokens in all failing test suites to use custom backend JWT tokens signed with `createJwtToken`. Guard `AuditService` against unready MongoDB connections.
- **Affected Files**:
  - `server/tests/eventStaffManagement.test.ts`
  - `server/tests/eventMemberRbac.test.ts`
  - `server/tests/eventCredentialArchitecture.test.ts`
  - `server/tests/eventTeamManagement.test.ts`
  - `server/src/modules/events/services/audit.service.ts`
- **Target**: 100% of the 11 `tests/event*.test.ts` suites passing.

### Batch 2: MongoDB Dashboard Service Hardening (DEF-02)
- **Objective**: Upgrade `DashboardService` to seamlessly query MongoDB `EventModel`, `EventCredentialModel`, and `GuestModel` while maintaining backward compatibility with legacy Postgres.
- **Affected Files**:
  - `server/src/modules/dashboard/services/dashboard.service.ts`
  - `server/src/modules/dashboard/controllers/dashboard.controller.ts`
  - `server/tests/dashboard.test.ts` (new regression test)
- **Target**: `GET /api/dashboard/stats` returns accurate metrics from MongoDB without requiring `DATABASE_URL`.

### Batch 3: Bulk Processing Memory Safety & Asynchronous Delegation (DEF-04)
- **Objective**: Enforce asynchronous background execution for large ticket rendering operations to eliminate memory exhaustion hazards.
- **Affected Files**:
  - `server/src/modules/tickets/controllers/ticket.controller.ts`
  - `server/src/modules/tickets/services/ticket.service.ts`
- **Target**: Bulk operations exceeding threshold seamlessly queue background jobs.

### Batch 4: End-to-End Browser & Integration Verification
- **Objective**: Run live server and client, execute Playwright browser tests covering full attendee and host journeys.
- **Target**: Screenshots and interaction logs verifying workspace switcher, registration, badge download, and check-in scanner.

---

## 4. Execution & Verification Log

### Log Entry — 2026-10-27
- **Baseline Audit**:
  - Confirmed 32 regression tests passing in `eventSwitcherBehaviorRegression.test.ts` and `eventLifecycleAuditFixes.test.ts`.
  - Confirmed clean production builds for both `client` (55.73s) and `server`.
  - Identified 4 failing test suites (49 test failures) caused by legacy Supabase token strings rejected by custom backend JWT `authMiddleware`.
  - Identified PostgreSQL dependency in `dashboard.service.ts`.
  - Initialized `ENGINEERING_PLAN.md`.
