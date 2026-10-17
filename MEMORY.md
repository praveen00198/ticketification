# MEMORY.md — Operational Knowledge & Architecture Truths

## 1. Permanent Architectural Truths
This file serves as the permanent institutional memory for Ticketification. All engineering agents and human contributors must adhere to these established truths:

1. **Product Purpose**: Ticketification is an **Event Operating + Credential + Access Platform**, NOT merely a single-use ticket generator.
2. **Current Product Priority**: The **Host Layer** is the active primary product focus (Phases 1–19).
3. **Attendee Platform**: The **Attendee Layer** is designed into the architecture but deferred to Phase 20.
4. **Public Platform**: The **Public Layer** remains functional and simple for now; interactive public features belong to Phase 21.
5. **One Global User Identity**: Every human has exactly one global user account. Roles (Host, Coordinator, Volunteer, Mentor, Evaluator, Attendee) are **event-scoped relationships** in `event_members`, NOT separate identity tables.
6. **Platform Roles vs. Event Roles**: Platform roles (`USER`, `ADMIN`, `SUPER_ADMIN`) are global and distinct from event roles (`HOST`, `COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR`).
7. **Infrastructure Triad**:
   - **Custom Backend JWT Authentication + PBKDF2** = Authentication (*"Who are you?"*), with MongoDB as the single source of truth for users, password hashes, and refresh sessions.
   - **MongoDB** = Application profiles, authorization, events, teams, evaluations, credential metadata, sessions, and audit logs (*"What can you do?"*).
   - **Supabase Storage** = Binary files exclusively (PNG passes, PDFs, templates, spreadsheets, ZIP archives). Supabase Auth is completely removed from the runtime.
8. **Zero Binaries in Database**: MongoDB MUST NEVER store image binaries, base64 strings, or large files.
9. **Backend is the Sole Security Boundary**: Frontend route guards and `localStorage` states are UX conveniences only. The backend validates authorization on every request.
10. **Modular Monolith**: The architecture is a Modular Monolith. No microservices unless explicitly justified by scale.
11. **Heavy Work Belongs in Background Jobs**: Bulk generation (1,000–20,000 tickets), large imports, and ZIP exports must execute asynchronously via background workers.
12. **Generic Credential Abstraction**: Internally, all passes are treated as "Event Credentials". The user-facing term adapts dynamically by event type (Ticket, Participant Pass, Attendee Pass, Badge).
13. **Opaque QR Tokens**: QR codes encode ONLY a 64-character verification URL. Zero attendee PII is ever encoded in QR codes.
14. **Atomic Concurrency Control**: Check-ins must use conditional atomic updates to eliminate race conditions between simultaneous scans.
15. **Paid Events Require Verification**: Paid events cannot collect payments without risk-based review and platform verification. Webhook confirmation must be signature-verified and idempotent.
16. **Existing Code Preservation**: Treat existing code as `LEGACY / UNTRUSTED IMPLEMENTATION`. Audit working components before replacing them.

---

## 2. Hard-Won Production Lessons & Anti-Patterns

### 2.1 The SVG vs. Real PNG Binary Trap
- **Lesson**: Legacy code generated SVG markup and renamed files to `.png` or relied on client-side canvas conversions.
- **Invariant**: All rendered credentials MUST be genuine PNG binaries (verified by checking the 8-byte PNG header `0x89504E47`) on the backend before storage upload. Zero SVG storage.

### 2.2 Memory Optimization on Render 512MB RAM Containers
- **Lesson**: Render Linux containers were terminated by the OOM killer (`Ran out of memory (used over 512MB)`) during bulk generation.
- **Root Causes**:
  1. Default `sharp.cache(true)` retained decompressed image buffers in native C++ memory across operations.
  2. The 1620x2025 background image was base64-encoded into the SVG markup, forcing librsvg to decode a 13.1 MB RGBA buffer per ticket.
  3. Concurrent worker threads (`BATCH_SIZE = 5`) caused native RSS spikes past 378MB.
- **Required Invariants**:
  1. Always configure `sharp.cache(false)` and `sharp.concurrency(1)`.
  2. Pre-load the background image buffer once and composite the SVG overlay via Sharp native bindings (`.composite([{ input: overlaySvg }])`).
  3. Bounded batch concurrency (1–2 tickets per batch) with immediate dereferencing of image buffers upon storage upload.
  4. RSS must remain stably under 200MB.

### 2.3 Devanagari / Hindi Complex Script Font Bundling
- **Lesson**: Devanagari text (e.g. `|| श्री गणेशाय नमः ||`, guest names in Hindi) rendered with broken glyphs and disconnected matras in minimal Linux containers.
- **Root Cause**: Offline server rasterization (librsvg / Pango) cannot fetch online `@import` web fonts, and minimal Linux containers lack Indic fonts in `/usr/share/fonts`.
- **Resolution & Invariant**: Always bundle Google `NotoSansDevanagari-Bold.ttf` in `assets/fonts/` and embed the font as base64 inside `@font-face` within the SVG markup. Pango and HarfBuzz resolve complex conjuncts and matra positioning flawlessly in memory.

### 2.4 Duplicate Route Mount Bug in Express `app.ts`
- **Lesson**: Mounting `/api/tickets` twice for different route files caused handler collisions.
- **Invariant**: Strict route namespace separation:
  - `/api/verification` ➔ Scanner and check-in endpoints
  - `/api/tickets` ➔ Credential management endpoints
  - `/api/events` ➔ Event management endpoints

### 2.5 In-Memory Rate Limiting Bottleneck
- **Lesson**: The legacy sliding-window rate limiter used an in-memory `Map<string, ClientRecord>()`. This does not scale across multiple cluster instances or server restarts.
- **Target Invariant**: Adopt distributed/shared token-bucket rate limiting (e.g. Redis or persistent token storage) with endpoint-aware thresholds.

### 2.6 Preserved Canonical Visual Assets
- **Asset**: `server/assets/ticket_template.png` (289 KB) is the canonical visual template. Do not delete or overwrite it.
- **Asset**: `server/assets/fonts/NotoSansDevanagari-Bold.ttf` is the canonical Indic font. Do not delete it.

### 2.7 Blind Review & Mentor/Evaluator Workspace Isolation (Phase 9)
- **Lesson**: Hackathons and competitions risk score contamination and bias if judges or mentors can access unassigned tracks or observe competing judge scorecards before rubric lock.
- **Invariant**:
  1. Mentors and evaluators access event workspace exclusively via `/api/events/:eventId/assignments/my-assignments`, returning strictly rows where `memberId == callerMemberId`.
  2. Competing scores, unassigned tracks, and confidential team metadata remain completely masked at both repository and service layers.
  3. All assignments enforce compound uniqueness `{ eventId: 1, memberId: 1, targetName: 1 }`.

### 2.8 Event Team Roster Bounds & Hackathon Lifecycle (Phase 10)
- **Lesson**: Unbounded team sizes create unfair competitive advantages in hackathons, while unvalidated team name duplicates disrupt booth and evaluation scoring.
- **Invariant**:
  1. Teams enforce compound unique index `{ eventId: 1, teamName: 1 }`.
  2. Maximum roster capacity is strictly bounded (6 members max).
  3. Duplicate member emails within a team roster are rejected at the service layer.
  4. Team leaders cannot be removed from their own team roster.
  5. Status updates to `SUBMITTED` record an immutable `submittedAt` timestamp for project lock deadlines.

### 2.9 Scoring Isolation, Rubric Phases & Leaderboard Sealing (Phase 11)
- **Lesson**: Live leaderboards leak competitive advantage and induce scoring collusion among judges if visible before all evaluations are finalized. In addition, unweighted scoring fails to capture diverse criterion importance.
- **Invariant**:
  1. Scorecard submissions enforce compound uniqueness `{ eventId: 1, teamId: 1, evaluatorMemberId: 1 }` — exactly one scorecard per evaluator per team.
  2. Weighted scores are calculated deterministically: `sum((score / maxScore) * weight)` with a precision of 2 decimal places.
  3. Rubric scoring follows strict phase transitions: `OPEN` (accepts scorecards) ➔ `CLOSED` (freezes scoring) ➔ `FINALIZED` (seals results and opens public leaderboard).
  4. Leaderboard is completely masked to evaluators and participants until the rubric scoring status is `FINALIZED`. Hosts and Coordinators retain live administrative preview.
  5. Lucide icons in React do not support the `title` attribute directly; wrap icons in `<span title="...">` or parent `<button title="...">` to prevent TypeScript TS2322 errors.

### 2.10 Generic Credential Abstraction & Atomic Sequencing (Phase 12)
- **Lesson**: Supporting diverse event archetypes (Conferences, Hackathons, Concerts, Festivals) without creating fragmented schemas requires an extensible generic pass model, gap-free monotonic sequence allocation, and zero-PII token lookups.
- **Invariant**:
  1. Monotonic sequence numbering per event uses dedicated atomic counters in `event_sequence_counters` via `findOneAndUpdate({ eventId }, { $inc: { lastSequenceNumber: 1 } }, { new: true, upsert: true })`.
  2. Formatting follows `<PREFIX>-00001` where `<PREFIX>` is derived from event credential terminology (e.g. `TIC`, `BDG`, `PASS`, `WRK`).
  3. Verification tokens are cryptographically secure 64-character hex strings generated via `crypto.randomBytes(32).toString('hex')`.
  4. Public token verification lookup (`/api/credentials/verify-token/:token`) sanitizes all sensitive PII (attendee email, phone number, and internal system IDs are never returned to public scanners or users).
  5. Check-in operations enforce atomic updates (`findOneAndUpdate` with `{ status: 'ACTIVE' }`) and support `SINGLE_USE`, `REUSABLE`, `MULTI_DAY`, and `WORKER_UNASSIGNED` policies.

### 2.11 Visual Credential Templates & Native Sharp Rasterization (Phase 13)
- **Lesson**: High-resolution image generation (badges, passes, tickets) on cloud containers with 512MB RAM constraints (Render) easily causes out-of-memory crashes if memory bounding is not strictly enforced. In addition, SVG overlays that use network `@import` fonts freeze libvips indefinitely in containerized or offline environments.
- **Invariant**:
  1. Always configure `sharp.cache(false)` and `sharp.concurrency(1)` to bound Sharp's thread pool and internal buffer allocation.
  2. SVGs used for Sharp text overlays must never contain remote `@import url(...)` declarations; all fonts must resolve locally via Fontconfig (`assets/fonts/`).
  3. All generated PNG outputs must be validated by inspecting the first 4 bytes for magic numbers `0x89504E47` (`\x89PNG`).
  4. Global presets (`CONFERENCE_BADGE`, `CONCERT_TICKET`, `HACKATHON_PASS`, `WORKER_PASS`) are immutable system templates; events clone presets into event-scoped copies with `{ eventId }` before modifying coordinates or styles.
  5. Jest tests invoking native C++ Sharp operations on high-resolution buffers (1620x2025) require `jest.setTimeout(30000)` on cold start, and `ts-jest` config must use `isolatedModules: true` to avoid whole-program AST compilation delays.

### 2.12 High-Throughput Atomic Check-in & Scanner Concurrency (Phase 14)
- **Lesson**: Day-of-event check-in gates experience sudden surges in scan concurrency. If check-in status validation relies on `find()` followed by `save()`, concurrent scans on the same pass at different entrance turnstiles will both succeed, allowing duplicate admissions.
- **Invariant**:
  1. For `SINGLE_USE` passes, admission must execute via a single conditional atomic update: `findOneAndUpdate({ _id, eventId, status: 'ACTIVE', usagePolicy: 'SINGLE_USE' }, { $set: { status: 'CHECKED_IN', firstCheckedInAt: now, lastCheckedInAt: now }, $inc: { checkInCount: 1 } })`.
  2. If the atomic update returns `null`, the scan is a duplicate; refetch and return `ALREADY_CHECKED_IN` with the prior timestamp.
  3. Every check-in attempt (whether successful, duplicate, revoked, or expired) must emit an immutable audit document to `event_credential_checkins` for audit compliance and velocity telemetry.
### 2.13 Asynchronous Job Processing & Memory-Bounded Queues (Phase 15)
- **Lesson**: Parsing multi-megabyte attendee spreadsheets and rasterizing thousands of credential passes inside synchronous HTTP requests leads to connection timeouts (Render 30s limit), thread contention, and container OOM crashes.
- **Invariant**:
  1. Operations generating or processing 50+ records must execute asynchronously via `event_jobs` queue engine and return `HTTP 202 Accepted` immediately with a `jobId`.
  2. Spreadsheet parsing (`.xlsx`, `.xls`, `.csv`) must use two-pass header detection (exact normalized match followed by synonym inclusion) while tracking claimed headers to prevent cross-column attribute collision (e.g. `Contact Email` must not be claimed by `Phone`).
  3. Contiguous sequence numbering across batch insertions must be atomically pre-allocated using `allocateSequenceBlock(eventId, count)` via MongoDB `findOneAndUpdate({ eventId }, { $inc: { lastSequenceNumber: count } })`.
  4. Sharp batch rasterization must be executed in bounded chunks of 2 with `sharp.concurrency(1)` and `sharp.cache(false)` to prevent Render 512MB RAM exhaustion.
  5. Only Hosts and Coordinators verified via MongoDB `event_members` can enqueue or cancel background jobs; unauthorized staff or external attendees are rejected with HTTP 403 Forbidden.

### 2.14 Streaming ZIP Archive Packaging & Presigned URL Exports (Phase 16)
- **Lesson**: Compiling archives of hundreds or thousands of high-resolution credential passes within Node.js process heap memory easily triggers heap allocation failure (`JavaScript heap out of memory`) on 512MB RAM containers. Proxying large file downloads through Express endpoints blocks event loop workers and exhausts server bandwidth.
- **Invariant**:
  1. Compiling ZIP archives must use streaming pipelines (`archiver` piped through stream chunks) rather than buffering the entire archive in Node memory.
  2. Finished archives and export spreadsheets must be written directly to Supabase Storage under `events/${eventId}/exports/`.
  3. Clients download export files via direct 24-hour presigned URLs issued by object storage (`supabaseStorageService.createPresignedDownloadUrl`), completely bypassing Node memory.
  4. Roster exports must query all matching event credentials via `findAllForExport(eventId, filters)` rather than paginated endpoints that arbitrarily cap output size.

### 2.15 Storage Quota Governance, Render 512MB Bounding, & Indic Typography (Phase 17)
- **Lesson**: Unmanaged export archives and heavy image buffers can silently breach cloud storage tier limits, while complex Indic fonts (Devanagari/Hindi) render as broken tofu glyphs on containerized Linux servers without embedded font definitions.
- **Invariant**:
  1. Always bundle and embed Google `NotoSansDevanagari-Bold.ttf` as base64 inside SVG templates via `@font-face` within `EventCredentialRenderingService` to guarantee deterministic complex script conjunct and matra rendering across all environments without network dependencies.
  2. Maintain `sharp.cache(false)` and `sharp.concurrency(1)` across all credential image rasterization pipelines to prevent libvips buffer retention outside V8 heap.
  3. Use `MemoryBudgetGovernor` to monitor process RSS against a 400MB threshold and proactively throttle execution if memory spikes.
  4. Enforce event storage quota governance (default 1024MB per event) before queuing bulk renders or exports, and provide an automated/on-demand stale export cleanup mechanism (`cleanupStaleExports`) to purge temporary archives older than 24 hours.

### 2.16 Immutable Audit Ledgers & Distributed Rate Limiting (Phase 18)
- **Lesson**: High-privilege actions (inviting/removing staff, revoking passes, purging storage) require tamper-proof accountability that cannot be altered or deleted. Additionally, unthrottled endpoints leave the system exposed to export flooding and scraping attacks.
- **Invariant**:
  1. Audit entries in `audit_logs` must be strictly append-only; Mongoose pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, and `findOneAndDelete` must throw invariant violation errors.
  2. Support both MongoDB ObjectIds and external/Supabase string identifiers (UUIDs) for `actorId` and `eventId` to prevent BSON casting failures in hybrid identity environments.
  3. All audit queries (`GET /api/events/:eventId/audit-logs`) must enforce Zero-Trust RBAC (accessible only to Hosts/Admins) and filter strictly by `{ eventId }` to eliminate cross-event IDOR leaks.
  4. Protect sensitive endpoints with endpoint-aware token-bucket rate limiters (`exportRateLimiter` at 10 req/min, `auditLogRateLimiter` at 60 req/min, `scannerRateLimiter` at 120 req/min).

### 2.17 Adaptive Event-Type UX & Aggregated Telemetry Pipelines (Phase 19)
- **Lesson**: A multi-event operating system serving hackathons, concerts, conferences, and workshops cannot force a single monolithic dashboard view. Displaying judging rubrics and team management cards on a Concert or Workshop page creates cognitive overload. Furthermore, issuing 6 independent network roundtrips from the host client on initial load degrades time-to-interactive.
- **Invariant**:
  1. Use parallelized server aggregation (`Promise.allSettled`) via `EventDashboardService` to bundle credentials, gate velocity (15m window), staff breakdown, team cohorts, storage metrics, and recent audit activity in a single `GET /api/events/:eventId/dashboard-summary` endpoint.
  2. Server must authoritatively derive event features (`deriveFeatures`) based on `eventType` (`hasCompetition`, `hasWorkshops`, `hasSeating`, `hasCheckinVelocity`, `hasBulkExports`) so clients do not duplicate ad-hoc business logic across components.
  3. UI consoles must be structured around contextual, tabbed workspaces (`Overview`, `Credentials & Access`, `Staff & Volunteers`, `Competition & Tracks`, `Gate & Check-in`, `Audit Trail`) rather than vertical card stacks.
  4. Conditionally render specialized workspaces: "Competition & Tracks" must only appear when `features.hasCompetition` is true (`HACKATHON`, `COMPETITION`, `COLLEGE_FEST`), keeping single-session and performance events focused.
  5. Schema models without continuous active database connections during unit tests must define `bufferCommands: false` to avoid silent Mongoose buffer deadlocks.

### 2.18 Attendee Self-Registration, Idempotent Credential Provisioning & Wallet Isolation (Phase 20)
- **Lesson**: Letting attendees self-register introduces concurrency and duplicate generation risks. If a user double-clicks registration or retries after network hiccups, issuing multiple credentials creates orphan passes and breaks sequence allocation. Additionally, cancellation must cascade down to revoke gate access.
- **Invariant**:
  1. Enforce unique registration compound index on `{ eventId: 1, userId: 1 }` in `event_registrations`. Repeated registration calls must be strictly idempotent and return the existing active registration and linked credential.
  2. Validate event lifecycle state prior to registration: events in `DRAFT`, `SUSPENDED`, `CANCELLED`, or `ARCHIVED` reject registration with HTTP 400.
  3. Enforce event capacity ceilings against active registrations (`status: 'CONFIRMED'`) before provisioning sequence numbers.
  4. Cascading Revocation: When an attendee cancels their registration, the linked `EventCredential` must be atomically updated to `REVOKED`, ensuring entrance turnstiles reject check-in attempts.
  5. The attendee wallet (`/wallet`) must aggregate both native self-registrations and organizer-imported credentials matching the authenticated user's email, ensuring a comprehensive cross-event pass hub.

### 2.19 Public Catalog Isolation, Zero-Trust Discovery & Abuse Governance (Phase 21)
- **Lesson**: Exposing public endpoints without strict lifecycle constraints risks leaking confidential draft events, suspended organizations, or personal organizer details. Furthermore, public abuse reporting channels must protect against missing email or empty payloads while providing platform admins with immutable audit records.
- **Invariant**:
  1. Public queries (`MongoEventRepository.findPublicEvents` and `findPublicById`) must strictly filter for `status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] }`. Any event in `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `SUSPENDED`, or `CANCELLED` must return 404 to avoid leaking draft event metadata (IDOR prevention).
  2. Sanitized Host Profiles: Public host endpoints must never leak phone numbers, password hashes, or internal database tokens. Only verified public brand fields (`organizationName`, `institutionType`, `institutionName`, `bio`, `website`, `logoUrl`, `hostVerificationStatus`) may be exposed.
  3. Public Abuse Reporting: `EventReportModel` validates minimum description length (10 chars), category enum, and valid email format. Submissions automatically log immutable entries into `audit_logs` (`EVENT_REPORTED`) for platform oversight.
  4. Test Timeouts under High Concurrency: Long rasterization operations in unit tests under heavy CPU load must explicitly configure timeout boundaries (e.g. 30,000ms) to prevent false-positive failures during full multi-suite regression runs.
### 2.20 Distributed Job Leases, Atomic Capacity Reservation & Bounded Archival Streaming
- **Lesson**: Asynchronous background jobs dispatched purely in memory (`setImmediate()`) are lost upon container recycling or process restarts. In multi-instance deployments, workers race to process the same jobs simultaneously without distributed coordination. Additionally, checking event capacity via non-atomic `countDocuments` permits over-registration, and accumulating multi-megabyte ZIP chunks in V8 heap causes 512MB RAM container crashes.
- **Invariant**:
  1. Background jobs in `event_jobs` must be persisted with `lockedBy`, `lockExpiresAt` (5m lease), `attempts`, `maxAttempts` (3), `failureReason`, and `nextRunAt` prior to dispatch acknowledgment.
  2. Workers claim jobs atomically via conditional update (`claimJob` / `claimNextAvailableJob`) verifying expiration and status.
  3. Eligible abandoned jobs must be safely recovered upon server restart (`recoverAbandonedJobs`).
  4. Transient failures must use bounded exponential retry backoff, and all error logs must be sanitized (`sanitizeErrorMessage`) to redact tokens, connection strings, and PII.
  5. Bulk pass rasterization must use cursor-based batch pagination (`findUnrenderedBatch` with `_id: { $gt: lastId }`) to process rosters beyond 500 records without hitting arbitrary caps.
  6. Capacity reservations must be atomic at the database level (`reserveRegistrationSlot` via `$expr: { $lt: ['$registration.confirmedCount', '$registration.capacity'] }` and `$inc: 1`). Any downstream registration failure must rollback the slot count.
  7. Partial unique compound indexes on `event_registrations` (`{ eventId: 1, userId: 1 }` and `{ eventId: 1, 'attendeeDetails.email': 1 }` for active statuses) prevent duplicate registrations under concurrent submissions.
  8. ZIP archive generation must stream directly to a temporary file (`fs.createWriteStream`) in `os.tmpdir()` and be piped to Supabase Storage before unlinking in `finally`, guaranteeing constant bounded memory usage.

### 2.21 Private Storage Presigned Downloads & Compare-And-Swap Capacity Reconciliation
- **Lesson**:
  1. Defaulting to public bucket URLs or falling back to `getPublicUrl()` on signed URL failure violates zero-trust data protection for private credentials. Furthermore, browser security blocks the HTML5 `download` attribute across origins, causing tickets to open in tabs instead of saving to disk.
  2. Background counter reconciliation that counts documents and blindly updates `confirmedCount` creates race conditions where concurrent in-flight reservations are clobbered by stale counts.
  3. Legacy events with missing counters or 0 counters must be initialized accurately without doing full collection scans on every registration request.
- **Invariant**:
  1. Supabase Storage buckets for credentials must be strictly private (`public: false`).
  2. Never fall back to public URLs on signed URL generation failure; throw typed `StorageError`.
  3. Attach `Content-Disposition: attachment; filename="<CanonicalFileName>"` via `{ download: fileName }` in `createSignedUrl` with 900s (15m) expiry.
  4. Authoritative capacity statuses are strictly `CONFIRMED` and `ATTENDED` (`CONFIRMED_CAPACITY_STATUSES`). Waitlisted and cancelled records never consume capacity slots.
  5. Capacity counter reconciliation MUST use Compare-And-Swap (CAS) with monotonic `reconcileVersion`. If a concurrent reservation or release increments the version while counting is in flight, the CAS update fails and yields/retries, ensuring concurrent reservations can NEVER be overwritten by a stale count.
  6. Once `reconciledAt` is set, reservations execute an atomic indexed query (`$lt: capacity`, `$inc: 1`) in O(1) time with ZERO collection scans on `event_registrations`.
  7. Slot release (`releaseRegistrationSlot`) is idempotent and tracks recently released tokens (`releasedTokens` bounded to 100 entries via `$slice: -100`), guaranteeing that repeated cancellations or rollbacks never double-decrement capacity.

### 2.22 Bulk Ticket Rendering Reliability, Terminal Job States & Non-Redundant Retries
- **Lesson**: Reporting full `COMPLETED` success when some tickets failed to render creates phantom completion states where hosts believe passes were issued but attendees receive nothing. Additionally, naive retries that re-render already completed tickets waste CPU/memory and risk creating conflicting or orphaned storage files. Fabricated event-date fallbacks (`2026-10-10`) display invalid dates on attendee tickets.
- **Invariant**:
  1. Never mark a rendering job `COMPLETED` while any ticket remains unrendered (`finalRemaining > 0` or failures in the current pass).
  2. Failed credentials must be recorded in `result.errorLog` with identifier and sanitized error.
  3. If unrendered tickets remain and attempts < maxAttempts, release the job back to `QUEUED` with bounded exponential backoff. Transition to `FAILED` only after max attempts are exhausted.
  4. Retries MUST query and process only unrendered credentials (`findUnrenderedBatch` with `{ 'asset.storagePath': { $in: [null, ''] } }`) and skip already rendered records. Never regenerate completed credentials.
  5. Storage keys must be deterministic (`events/{eventId}/credentials/{credentialId}.png`) to guarantee idempotent overwrites on retry without orphaned files.
  6. Workers must prove lease ownership (`lockedBy: workerId` AND `lockExpiresAt: { $gte: now }`) on progress updates and job completion. Stale workers are rejected.
  7. Remove all hardcoded `2026-10-10` fallbacks. Resolve event date from `schedule.startAt` or default safely to `'Date TBA'`.

### 2.23 Bounded-Memory Keyset ZIP Export, Cursor Streaming & Safe Error Cleanup (Fix 4)
- **Lesson**: Synchronous or unbounded in-memory ZIP archiving (`archiver.pipe(res)` without backpressure or materializing whole arrays into Node.js heap) causes container OOM crashes and server freezes when exporting events with hundreds or thousands of passes. Furthermore, offset-based pagination (`skip`) suffers from O(N) database degradation and duplicate/omitted records during concurrent insertions.
- **Invariant**:
  1. Keyset pagination on monotonic sequence numbers (`sequenceNumber > lastSequenceNumber` sorted by `{ sequenceNumber: 1 }` with limit <= 50) guarantees stable, gap-free pagination without duplicate or omitted records.
  2. Cursor-based streaming (`findExportCursor` returning an async iterable cursor) processes records incrementally in bounded batches of 50. Total concurrent in-memory records are strictly bounded to <= 50.
  3. Archive outputs stream directly to disk (`fs.createWriteStream` in `os.tmpdir()`) rather than accumulating buffers in V8 memory.
  4. Stream backpressure MUST be explicitly handled: check `writeStream.writableNeedDrain` after each archive append and `await new Promise((resolve) => writeStream.once('drain', resolve))` before processing next passes.
  5. Temporary files must be reliably removed (`fs.promises.unlink`) in `finally` blocks on ALL exit paths (success, error, cancellation, lease loss).
  6. Incomplete archives MUST NEVER be marked `COMPLETED`: if any ticket cannot be packaged or rendered, or if fewer files than expected are packaged, the job fails with a descriptive error and temp files are discarded.
  7. Cancellation checks (`job.status === 'CANCELLED'`) and lease renewal (`renewLease`) must execute periodically (every 10–50 passes) during export streaming to abort orphaned jobs and terminate resource consumption promptly.
### 2.24 Idempotent Bulk Attendee Import & Reusable Sequence Allocation (Fix 5)
- **Lesson**: Bulk attendee roster imports from spreadsheets can fail midway through execution or worker lease expiration. If sequence allocations are re-calculated on every retry, large sequence numbering gaps are generated, and sequence counters drift unpredictably. Furthermore, re-running failed or partial imports with naive inserts throws duplicate key errors on `{ eventId: 1, sequenceNumber: 1 }` or duplicates records, while naive overwrites wipe out sensitive tokens or custom edits.
- **Invariant**:
  1. Monotonic sequence numbers allocated via `allocateSequenceBlock(eventId, count)` must be persisted into `job.payload.startingSequence` and `job.payload.endSequence` on the first attempt. On retries, the worker MUST reuse the persisted sequence block and NEVER re-increment the sequence counter.
  2. Bulk credential writes must use `$setOnInsert` semantics matching `{ eventId, sequenceNumber }`. Existing committed records are detected and preserved, and sensitive fields (`verificationToken`, attendee details) remain intact.
  3. Source files containing duplicate rows (e.g. identical emails) are detected via in-memory deduplication tracking (`Set<string>`). Duplicate rows are skipped, incrementing `skippedCount` and appending an explanatory entry to `result.errorLog` without crashing the batch.
  4. Succeeded count strictly reflects actually created or already active credentials for the chunk, eliminating duplicate counting.
  5. Error logs are deduplicated across chunk iterations and retries to avoid duplicate error entries for the same row.
  6. Distributed worker lease ownership (`lockedBy: workerId` and valid lease expiry) is strictly enforced on all progress updates and completion calls.

