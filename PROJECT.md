# Project: Ticketification High-Throughput Ticket Generation & QR Scanner Optimization

## Architecture
The system is a Modular Monolith built on Node.js, Express, TypeScript, MongoDB (Mongoose), Supabase Storage, and React 18 / Vite on the frontend.
The optimization targets two critical operational pathways:
1. **Ticket Generation Pipeline (Async Background Worker & Sharp)**: Controlled sequential image generation (BATCH_SIZE = 1, concurrency = 1), zero Base64 allocations, immediate buffer dereferencing, libvips memory release, direct Supabase storage upload, and resumable MongoDB job tracking.
2. **Turnstile QR Scanner & Verification Subsystem**: Persistent React `html5-qrcode` camera stream lifecycle, shared audio singleton, in-flight frame locking, token duplicate suppression, native IndexedDB offline scan queue with strict 5xx/network error boundaries, atomic conditional MongoDB verification (`findOneAndUpdate`), idempotency key replay, and bounded sequential batch synchronization.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 Sequential Batch Size = 1 | Set `BATCH_SIZE = 1` and `concurrency = 1` in `processBulkRenderJob` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R1.2 Elimination of Base64 Conversion | Remove `pngBuffer.toString('base64')` from `ticket-image.service.ts` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | R1.3 Buffer Dereferencing & GC Triggers | Explicitly dereference buffers and invoke `memoryBudgetGovernor` / GC | M1 | ORIGINAL_REQUEST §R1 |
| 4 | R1.4 Memory Usage Diagnostics Logging | Integrate `process.memoryUsage()` logging at start, per-ticket, and completion | M1 | ORIGINAL_REQUEST §R1 |
| 5 | R1.5 Idempotent Resume & Duplicate Prevention | Verify unrendered query filter and updateProgress atomic updates | M1 | ORIGINAL_REQUEST §R1 |
| 6 | R1.6 Puppeteer / PDF / ZIP Exclusion | Remove unused Puppeteer imports and enforce strict PNG output invariant | M1 | ORIGINAL_REQUEST §R1 |
| 7 | R2.1 Persistent Single Camera Stream | Stop stream leaks, extract and stop `MediaStreamTrack`s on unmount | M2 | ORIGINAL_REQUEST §R2 |
| 8 | R2.2 In-Flight Verification Lock | Drop incoming frames while a verification request is pending | M2 | ORIGINAL_REQUEST §R2 |
| 9 | R2.3 Token-Specific Duplicate Suppression | Suppress same token for 4,000ms; scan different token with 0ms delay | M2 | ORIGINAL_REQUEST §R2 |
| 10 | R2.4 Audio Singleton Context | Replace per-chime `new AudioContext()` with shared singleton | M2 | ORIGINAL_REQUEST §R2 |
| 11 | R4.1 Client IndexedDB Offline Store | Native IndexedDB storage (`ticketification_offline_db`) for queued scans | M2 | ORIGINAL_REQUEST §R4 |
| 12 | R4.2 Strict Offline Activation Boundary | Trigger offline queue strictly on network error, timeout, or HTTP 5xx | M2 | ORIGINAL_REQUEST §R4 |
| 13 | R4.3 Scanner UI Offline & PENDING_SYNC | Display amber `PENDING_SYNC` card and offline banner; never false `VALID` | M2 | ORIGINAL_REQUEST §R4 |
| 14 | R3.1 Targeted Projection & No Populate | Remove `.populate()` in repository and add `.select()` projections | M3 | ORIGINAL_REQUEST §R3 |
| 15 | R3.2 MongoDB Indexing | Add index on `formattedId` and compound index on `{ eventId, idempotencyKey }` | M3 | ORIGINAL_REQUEST §R3 |
| 16 | R3.3 Atomic Concurrency Check-In | Event-scoped `findOneAndUpdate({ _id, eventId, status: 'ACTIVE' })` | M3 | ORIGINAL_REQUEST §R3 |
| 17 | R3.4 Idempotency Key Replay Handling | Recognize retried scans with same idempotency key and replay success without error | M3 | ORIGINAL_REQUEST §R3 |
| 18 | R5.1 Reachability Health Endpoint | `GET /api/verify/health` lightweight endpoint (<5ms, no DB) | M3 | ORIGINAL_REQUEST §R5 |
| 19 | R5.2 Bounded Batch Sync Endpoint | `POST /api/verify/sync` processing queued scans with collision resolution | M3 | ORIGINAL_REQUEST §R5 |
| 20 | R5.3 Client Recovery & Sync Coordination | Automatic sync upon online event, per-record server acknowledgement | M2, M3 | ORIGINAL_REQUEST §R5 |
| 21 | R6.1 Scope & Execution Governance | Strict file scope, zero test/build execution, deferred test scenarios catalog | M4 | ORIGINAL_REQUEST §R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Bulk Ticket Generation Memory Optimization | R1.1–R1.6 | none | **DONE** |
| M2 | QR Scanner Stability & Client Offline Queue | R2.1–R2.4, R4.1–R4.3, R5.3 | none | **DONE** |
| M3 | Backend Verification Concurrency & Sync | R3.1–R3.4, R5.1–R5.2 | none | **DONE** |
| M4 | Gate Verification, Auditing & Final Report | R6.1 | M1, M2, M3 | **DONE** |

## Exclusive File Boundaries
### Milestone 1:
- `server/src/modules/tickets/services/ticket-image.service.ts`
- `server/src/modules/events/services/event-job-queue.service.ts`
- `server/src/modules/events/services/event-credential-rendering.service.ts`
- `server/src/modules/guests/services/guest-import.service.ts`
- `server/src/modules/tickets/services/ticket.service.ts`

### Milestone 2:
- `client/src/utils/scannerFeedback.ts`
- `client/src/services/offlineScanQueue.ts`
- `client/src/components/scanner/QrScanner.tsx`
- `client/src/api/verify.ts`
- `client/src/pages/ScannerPage.tsx`
- `client/src/components/events/EventCheckinScannerCard.tsx`

### Milestone 3:
- `server/src/db/mongo/models/event-credential.model.ts`
- `server/src/db/mongo/models/event-credential-checkin.model.ts`
- `server/src/modules/events/repositories/mongo-event-credential.repository.ts`
- `server/src/modules/verification/services/verification.service.ts`
- `server/src/modules/verification/controllers/verification.controller.ts`
- `server/src/modules/verification/routes/verification.routes.ts`
- `server/src/modules/events/controllers/event-credential-checkin.controller.ts`
- `server/src/modules/events/services/event-credential-checkin.service.ts`
