# Phase 15 Audit & Implementation Plan — Import + Bulk Credential Generation Jobs

## 1. Domain Overview & Mission
Phase 15 delivers high-capacity, asynchronous attendee data ingestion and bulk credential generation for Ticketification. It enables event hosts to import thousands of attendees (via Excel `.xlsx` / CSV), validate rosters, and asynchronously issue credentials with bounded-memory background jobs conforming to Render 512MB RAM constraints (ADR-007, ADR-008, RULES.md Section 6).

### Key Architectural Requirements
1. **Asynchronous Job Pattern (RULES.md Section 6.1 & 6.2)**:
   - Heavy operations (importing 50+ records, bulk issuing, rasterizing passes) MUST NEVER execute synchronously within an HTTP request.
   - Mutating endpoints respond immediately with `202 Accepted` returning a `jobId` and job metadata.
2. **Memory Bounded Background Worker (RULES.md Section 6.3)**:
   - Max 1-2 tickets rasterized per Sharp batch with immediate buffer dereferencing to prevent V8/libvips RAM spikes.
   - Concurrency bounded to 1 (`sharp.concurrency(1)`, `sharp.cache(false)`).
3. **Atomic Monotonic Sequencing**:
   - Uses `allocateSequenceBlock(eventId, count)` on `EventSequenceCounterModel` to reserve contiguous sequence blocks in O(1) time without ID collisions.
4. **Robust Column Mapping & Validation**:
   - Intelligent header detection across synonyms (`name`, `full name`, `attendee`, `email`, `mail`, `phone`, `mobile`, `category`, `role`, `organization`, `company`, `college`).
   - Row-level validation reporting invalid rows without aborting valid entries.
5. **Zero-Trust Staff RBAC**:
   - Initiating import and bulk rendering jobs requires `HOST` or `COORDINATOR` role evaluated via `event_members`.

---

## 2. Technical Architecture & Layered Implementation

### Backend Structure
1. **Model**: `server/src/db/mongo/models/event-job.model.ts`
   - Canonical MongoDB collection: `event_jobs` (`IEventJobDocument`).
   - Fields: `eventId`, `jobType`, `status`, `progress`, `payload`, `result`, `createdBy`, timestamps.
   - Compound Indexes: `{ eventId: 1, createdAt: -1 }`, `{ status: 1 }`.
2. **Repository**: `server/src/modules/events/repositories/mongo-event-job.repository.ts`
   - CRUD and atomic state transitions for background jobs (`createJob`, `updateProgress`, `markCompleted`, `markFailed`, `findByEventId`, `findById`).
3. **Services**:
   - `server/src/modules/events/services/event-import-parser.service.ts`:
     - Fast xlsx/csv buffer parsing, header auto-detection, and row validation.
   - `server/src/modules/events/services/event-job-queue.service.ts`:
     - In-process bounded queue worker executing background jobs sequentially in chunks.
     - Implements `processImportJob` and `processBulkRenderJob`.
4. **Controller**: `server/src/modules/events/controllers/event-job.controller.ts`
   - `previewImport`: Synchronous fast preview of uploaded spreadsheet (returns headers, row count, sample preview).
   - `createImportJob`: Asynchronous job creation (`202 Accepted`).
   - `createBulkRenderJob`: Asynchronous bulk Sharp render creation (`202 Accepted`).
   - `listJobs`: Queries jobs for event.
   - `getJobStatus`: Polls status and percentage.
   - `cancelJob`: Cancels pending job.
5. **Routes**: `server/src/modules/events/routes/event-job.routes.ts`
   - Mounted at `/:eventId/jobs` inside `event.routes.ts`.
6. **Automated Test Suite**: `server/tests/bulkJobQueueEngine.test.ts`
   - Header detection and staging preview validation.
   - 202 Accepted async job queuing.
   - Atomic sequence allocation and batch credential insertion.
   - Progress tracking from `QUEUED` -> `PROCESSING` -> `COMPLETED`.
   - Memory bounded chunked Sharp rasterization.
   - RBAC verification (Host/Coordinator vs unauthorized).

### Frontend Structure
1. **API Client**: `client/src/api/events.ts`
   - Extended with Phase 15 job interfaces and methods: `previewImportSpreadsheet`, `createImportJob`, `createBulkRenderJob`, `getEventJobs`, `getJobStatus`, `cancelJob`.
2. **Component**: `client/src/components/events/EventImportBulkModal.tsx`
   - File dropzone (`.xlsx`, `.xls`, `.csv`).
   - Column auto-mapping preview table with validation badges.
   - Real-time progress bar with percentage, processed/succeeded/failed count, error log drawer.
   - Mounted inside `EventCredentialManagerCard.tsx`.
