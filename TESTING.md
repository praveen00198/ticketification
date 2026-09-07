# TESTING.md — Testing Strategy & Verification Matrix

## 1. Testing Philosophy
Testing is a first-class architectural invariant. A feature or bugfix is not complete until covered by automated tests that verify correctness, security, data integrity, and regression resistance.

---

## 2. Test Execution Commands
- **Backend Tests**: `npm --prefix server test`
- **Backend Build Check**: `npm --prefix server run build`
- **Frontend Build Check**: `npm --prefix client run build`

---

## 3. Test Suites & Coverage Matrix

### 3.1 Authentication & Authorization (`auth.test.ts`)
- [ ] Successful user registration via Supabase Auth.
- [ ] Successful user login returning valid JWT.
- [ ] Rejection of unauthenticated requests with HTTP 401.
- [ ] Rejection of expired or malformed Bearer tokens with HTTP 401.
- [ ] IDOR Prevention: User A cannot read, update, or delete Event B belonging to User B (HTTP 404/403).

### 3.2 Event Management (`events.test.ts`)
- [ ] Create event with valid payload; confirm default ticket types (`GENERAL`, `VIP`, `WORKER`) auto-seeded.
- [ ] Event list returns only events owned by the authenticated user with explicit `ORDER BY created_at DESC`.
- [ ] Update event details enforces ownership.

### 3.3 Excel Import Engine (`excelValidation.test.ts`)
- [ ] Standard file with `Name`, `Category`, `Phone` parsed accurately.
- [ ] Optional phone and email fields can be omitted without validation failure.
- [ ] User custom column mappings correctly map arbitrary headers to domain fields.
- [ ] Missing required fields (`Name`) flagged with row-level validation errors.
- [ ] Malicious / oversized / corrupted files rejected gracefully with clear error messages.

### 3.4 Ticket Rendering & Storage (`ticketGeneration.test.ts`)
- [ ] VIP and Guest tickets assigned `SINGLE_USE` policy.
- [ ] Worker tickets assigned `REUSABLE` policy.
- [ ] Rendered ticket buffer verified with `isPngBuffer()` (8-byte PNG header check: `0x89504E47`).
- [ ] Ticket ID (e.g. `GAN-00001`) NOT visibly printed on the ticket image.
- [ ] QR code verified to contain opaque token URL without PII.
- [ ] Filenames formatted as `<Guest-Name>-<Ticket-ID>.png` with all traversal/illegal characters stripped.
- [ ] Failure in Supabase Storage upload halts database insertion; no silent fallback to local storage.

### 3.5 Ticket Downloads & Bulk Export (`downloads.test.ts`)
- [ ] Individual download retrieves the existing PNG asset from Supabase Storage without regenerating.
- [ ] Bulk download streams a ZIP archive containing ONLY genuine PNG files.
- [ ] Zero SVG files, zero text manifests, zero duplicate files inside the ZIP.
- [ ] Controlled concurrency (batching) verified during large export simulation.

### 3.6 Verification & Atomic Check-In (`verification.test.ts`)
- [ ] Valid single-use ticket returns `VALID` and marks status as `USED`.
- [ ] Immediate second scan of single-use ticket returns `ALREADY_USED` with prior check-in timestamp.
- [ ] Concurrent scan race condition: 5 simultaneous verification requests for the same ticket result in exactly 1 `VALID` and 4 `ALREADY_USED` (atomic conditional update).
- [ ] Cross-event scan: Ticket from Event B scanned in Event A scanner returns `WRONG_EVENT`.
- [ ] Reusable worker pass scans successfully multiple times; each scan logs an audit row in `ticket_checkins`.
- [ ] Unassigned worker pass on first scan: prompts for worker name, updates ticket and guest record, and completes first check-in atomically.

---

## 4. Regression Prevention Workflow
When a defect is reported:
1. Write a focused reproducing test case that fails.
2. Implement the clean architectural fix in the responsible layer.
3. Verify the reproducing test now passes.
4. Run the full test suite (`npm test`) and type checks (`npm run build`) to guarantee zero regressions.
