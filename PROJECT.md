# Project: Ticketification Excel Export, Guest Roster UI, Ticket Generation & CPU Optimization

## Architecture
The system is a Modular Monolith built on Node.js, Express, TypeScript, MongoDB (Mongoose), Supabase Storage, and React 18 / Vite on the frontend.
The platform provides high-throughput event operating, credential generation, and guest roster management capabilities.

The current architecture updates target 4 core operational subsystems:
1. **Full Database Export Pipeline**: Unbounded, event-scoped attendee and credential data export directly from MongoDB, enforcing strict authenticated Host/Coordinator authorization (`userId` check in `event_members`), removing the 200-row repository clamp, and computing deterministic storage URLs without synchronous network latency.
2. **Guest Roster Import UI Status & Resilience**: Scoped error notification state management in `GuestImport.tsx` (clearing error upon step transitions and suppressing error display on the completion celebration card), defensive API response unwrapping in `guests.ts`, and per-row error isolation in `guest-import.service.ts` so partial rows or warnings never trigger false failure banners.
3. **Autonomous Background Ticket Generation UI**: Complete removal of the manual "Generate All Tickets" button and modal from `TicketList.tsx`. Real-time polling of background generation jobs (`eventsApi.getEventJobs` / `getEventJobStatus`), dynamic emerald progress bar with pass counts, and a resilient "Resume / Retry Generation" action calling `eventsApi.createBulkRenderJob`.
4. **Ticket Generation Performance & CPU Optimization**: Cooperative event loop yielding (`setTimeout(..., 20)`) in `event-job-queue.service.ts` to prevent CPU starvation and container SIGKILL restarts, Sharp PNG compression tuned to `compressionLevel: 6, effort: 2`, elimination of ~600KB inline base64 font in SVGs (relying on native Fontconfig), throttled garbage collection (`processedCount % 25 === 0` or memory-constrained), and removal of duplicate database writes.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Full Database Excel Export Query | Remove `Math.min(..., 200)` clamp in `mongo-event-credential.repository.ts` and use `findAllForExport` for export requests | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Host Permission Verification & IDOR Fix | In `ticket.service.ts`, strictly verify `userId: callerUserId` in `EventMemberModel.findOne` for event hosts/coordinators | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Fast Deterministic Storage URL Construction | Eliminate synchronous per-ticket `checkObjectExists` network calls in `ticket.service.ts:generateTicketsExcel` | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Client Error State Hygiene | In `GuestImport.tsx`, clear `error` state on step transitions (`handleProceedToCategories`, `handleRunValidation`, `handleConfirmImport`) and hide error banner when `step === 'complete'` | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Defensive API Response Unwrapping | In `client/src/api/guests.ts`, ensure `confirmImport`, `validateImport`, and `uploadFile` safely unwrap `res?.data ?? res` | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Per-Row Import Error Isolation | In `guest-import.service.ts:confirmImport`, wrap `EventCredentialModel.create` in per-row try/catch so individual errors do not abort the entire import | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Job Ingestion & Render Status Decoupling | In `event-job-queue.service.ts:744`, do not mark entire import job `FAILED` if guest credentials were successfully created in MongoDB | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Removal of Manual Generate Button & Modal | Remove manual "Generate All Tickets" button and modal from `client/src/pages/TicketList.tsx` | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Real-Time Ticket Generation Progress UI | In `TicketList.tsx`, poll `eventsApi.getEventJobs` / `getEventJobStatus` every 2s and display real-time progress bar, percentage, and pass counts | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Resilient Resume/Retry Generation Action | In `TicketList.tsx`, render a "Resume / Retry Generation" button wired to `eventsApi.createBulkRenderJob(currentEvent.id)` | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Cooperative Event Loop Yielding | In `event-job-queue.service.ts`, add `await new Promise(r => setTimeout(r, 20))` in worker loop to prevent CPU 100% starvation and container crashes | M3 | ORIGINAL_REQUEST §R4 |
| 12 | Sharp PNG Compression Tuning | In `event-credential-rendering.service.ts` and `ticket-image.service.ts`, tune Sharp output to `.png({ compressionLevel: 6, effort: 2 })` | M3 | ORIGINAL_REQUEST §R4 |
| 13 | Elimination of Redundant Inline Base64 Font | In `ticket-image.service.ts` and `event-credential-rendering.service.ts`, remove ~600KB inline base64 font and HTTP `@import` from SVG overlays | M3 | ORIGINAL_REQUEST §R4 |
| 14 | Throttled Garbage Collection & DB Writes | In `event-job-queue.service.ts`, throttle GC to every 25 tickets and remove duplicate `await cred.save()` after `markRenderCompleted` | M3 | ORIGINAL_REQUEST §R4 |
| 15 | Synchronous Generation Fallback to Queue | In `ticket.service.ts`, delegate synchronous generation with >50 tickets to `enqueueBulkRenderJob` instead of throwing `ValidationError` | M3 | ORIGINAL_REQUEST §R4 |
| 16 | Comprehensive E2E Test Suite | Build 4-tier opaque-box test suite verifying export, roster status, generation queue, and performance invariants | M4 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Full Database Export for Excel with Event Scoping | Features 1, 2, 3 | none | DONE |
| M2 | Guest Roster Import UI Status & Ingestion Resilience | Features 4, 5, 6, 7 | none | DONE |
| M3 | Ticket Generation Workflow, Progress UI & CPU Optimization | Features 8, 9, 10, 11, 12, 13, 14, 15 | none | DONE |
| M4 | Dual Track E2E Test Suite Verification & Audit | Feature 16 | M1, M2, M3 | IN_PROGRESS |

## Exclusive File Boundaries
### Milestone 1 (M1):
- `server/src/modules/events/repositories/mongo-event-credential.repository.ts`
- `server/src/modules/tickets/services/ticket.service.ts`
- `server/tests/excelExport.test.ts`

### Milestone 2 (M2):
- `client/src/pages/GuestImport.tsx`
- `client/src/api/guests.ts`
- `server/src/modules/guests/services/guest-import.service.ts`
- `server/tests/guestImportStatus.test.ts`

### Milestone 3 (M3):
- `client/src/pages/TicketList.tsx`
- `server/src/modules/events/services/event-job-queue.service.ts`
- `server/src/modules/events/services/event-credential-rendering.service.ts`
- `server/src/modules/tickets/services/ticket-image.service.ts`
- `server/tests/ticketGenPerf.test.ts`

### Milestone 4 (M4):
- `tests/e2e/`
- `TEST_INFRA.md`
- `TEST_READY.md`

## Interface Contracts
### Excel Export (`M1` ↔ `Client`)
- Route: `GET /api/tickets/events/:eventId/export-excel`
- Query Params: `ticketIds` (optional array of IDs)
- Response: Binary Excel (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), file header `Content-Disposition: attachment; filename="<slug>-attendees-<timestamp>.xlsx"`
- Auth: Requester must be Event Owner or have active `HOST` / `COORDINATOR` role in `event_members`. Returns 403/404 if unauthorized.
- Volume: Supports full event dataset (e.g. 716+ rows) without 200 clamp.

### Guest Import (`M2` ↔ `Client`)
- Route: `POST /api/guests/events/:eventId/confirm`
- Response: `{ success: true, data: { importedCount: number, skippedCount: number, errors?: string[] } }`
- Client Contract: Unwraps `res?.data ?? res`. Error banner displays only if `success === false` and `step !== 'complete'`.

### Ticket Generation Queue (`M3` ↔ `Client`)
- Query Route: `GET /api/events/:eventId/jobs?jobType=BULK_RENDER_ASSETS&limit=5`
- Response: `EventJobItem[]` with `_id, status ('QUEUED'|'PROCESSING'|'COMPLETED'|'FAILED'), progress { total, completed, failed }`
- Resume Route: `POST /api/events/:eventId/jobs/bulk-render`
- Response: `{ success: true, data: EventJobItem }`
- Worker Throttling: 20ms cooperative yield per ticket, `compressionLevel: 6, effort: 2`, native Fontconfig without base64 SVG embedding.
