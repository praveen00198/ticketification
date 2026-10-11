# TESTING.md — Testing Strategy & Verification Matrix

## 1. Testing Philosophy & Verification Gates

Automated testing is a primary engineering invariant in Ticketification. No code is considered production-ready without passing comprehensive automated verification.

> [!CRITICAL]
> **Regression Policy**:
> Every bug fix must begin with a reproduction test case that fails before the code change and passes after. The full suite (`npm test`) and type check (`npm run build`) must run clean before completing any phase.

---

## 2. Test Execution Commands
- **Backend Test Suite**: `npm --prefix server test`
- **Backend Type & Build Check**: `npm --prefix server run build`
- **Frontend Type & Build Check**: `npm --prefix client run build`

---

## 3. Comprehensive Verification Matrix

### 3.1 Authentication & Token Lifecycle
- [ ] **Sign Up**: Register new user via Supabase Auth; verify global application profile created with default role `USER`.
- [ ] **Login**: Authenticate valid credentials; verify receipt of valid JWT access token.
- [ ] **Logout**: Invalidate session; verify subsequent requests with prior token are handled safely.
- [ ] **Token Expiry**: Expired JWT returns HTTP 401 with standard error payload.
- [ ] **Invalid / Tampered Token**: Altered JWT signature returns HTTP 401 immediately.

### 3.2 Authorization & Role-Based Access Control (RBAC)
- [ ] **Normal User Admin Access Blocked**: User with role `USER` attempting to access platform admin endpoints receives HTTP 403 Forbidden.
- [ ] **Event Ownership Isolation (IDOR)**: User A cannot read, update, or delete Event B belonging to Host B (HTTP 404 or 403).
- [ ] **Volunteer Restricted Access**: Volunteer cannot access Host settings, financial records, or credential generation endpoints.
- [ ] **Volunteer Scanning Permission**: Volunteer without `SCAN_CREDENTIALS` permission is rejected from the check-in endpoint (HTTP 403); volunteer with the permission succeeds.
- [ ] **Evaluator Score Isolation**: Evaluator A cannot view or alter Evaluator B's private scores before finalization.
- [ ] **Coordinator Boundaries**: Coordinator cannot delete the event, change event owner, or modify payment settings.
- [ ] **Suspension Enforcement**: Suspended users or suspended events are immediately blocked from all authenticated mutations.

### 3.3 Event Management & Lifecycle
- [ ] **Event Creation**: Host creates event with type (e.g. `HACKATHON`); confirm default credential taxonomy set.
- [ ] **Event Update**: Host updates venue and dates; unauthorized users rejected.
- [ ] **Lifecycle Transitions**: Event transitions through `DRAFT` ➔ `SUBMITTED` ➔ `APPROVED` ➔ `PUBLISHED` ➔ `EVENT_LIVE` ➔ `COMPLETED` ➔ `ARCHIVED`. Invalid transitions (e.g. `DRAFT` directly to `EVENT_LIVE`) return HTTP 400.
- [ ] **Event Cancellation & Suspension**: Suspended event halts new registrations and credential generation immediately.

### 3.4 Registration & Ingestion Pipelines
- [ ] **Duplicate Registration**: Attempting to register twice with the same email/phone is rejected idempotently.
- [ ] **Concurrent Registration / Capacity**: When capacity is 1 and 2 attendees register simultaneously, exactly 1 succeeds and 1 is added to waitlist.
- [ ] **Waitlist Promotion**: Opening capacity promotes the next waitlisted applicant.
- [ ] **Paid Registration & Webhooks**: Payment gateway webhook with valid HMAC signature marks registration `PAID` and triggers credential generation.
- [ ] **Webhook Idempotency & Retries**: Sending the same webhook payload multiple times results in exactly 1 payment record and 1 credential.
- [ ] **Untrusted Browser Redirect**: Calling `/payment/success` directly from the client without webhook confirmation does NOT mark registration as paid.

### 3.5 Credential Generation & Templates
- [ ] **Single Credential Generation**: Generates 1620x2025 genuine PNG binary (`0x89504E47`) and uploads to Supabase Storage.
- [ ] **No Sequential IDs on Public Pass**: Verifies generated pass image does not visibly print sequential database IDs.
- [ ] **Bulk Generation Jobs**: Requesting bulk generation (1,000+ tickets) returns `202 Accepted` with `jobId`; background worker processes in bounded batches.
- [ ] **Storage Failure Rollback**: Storage upload failure aborts credential database insertion; zero local disk fallback.
- [ ] **Duplicate Generation Prevention**: Re-running bulk generation for an event skips already-generated attendees.

### 3.6 Day-of-Event QR Verification & Atomic Check-In
- [ ] **Valid Single-Use Check-In**: First scan of an active ticket returns `SUCCESS` and updates status to `CHECKED_IN`.
- [ ] **Immediate Repeat Scan**: Second scan returns `ALREADY_CHECKED_IN` with prior timestamp.
- [ ] **Simultaneous Scan Race Condition**: 5 concurrent check-in requests for the same ticket result in exactly 1 `SUCCESS` and 4 `ALREADY_CHECKED_IN`.
- [ ] **Wrong Event Scan**: Scanning Event A credential with Event B scanner returns `WRONG_EVENT`.
- [ ] **Reusable Worker Passes**: Allowed multiple entries; each scan appends an entry to check-in logs.
- [ ] **Unassigned Worker Pass**: Prompts for worker name on first scan, saves name, and completes check-in atomically.

### 3.7 Excel / CSV Import Engine
- [ ] **Dynamic Header Detection**: Parses spreadsheets with arbitrary header names (`Full Name`, `Contact`, `Email`).
- [ ] **Optional Fields**: Missing phone and email pass validation when marked optional.
- [ ] **Invalid Row Highlighting**: Missing required fields are flagged with specific row error reports.
- [ ] **Large File Handling**: Large spreadsheets (> 10,000 rows) are processed asynchronously via worker queue without memory exhaustion.

### 3.8 Hackathon Evaluation & Scoring
- [ ] **Judge Assignments**: Judges only see teams explicitly assigned to them.
- [ ] **Scoring Submission**: Judges submit scores matching criteria rubrics.
- [ ] **Scoring Finalization**: Once the round is `FINALIZED`, judges cannot mutate scores.
- [ ] **Administrative Score Override**: Host override requires a mandatory rationale and creates an audit log entry.
- [ ] **Leaderboard Ranking**: Ranks teams accurately by weighted total scores with tie-breakers.

### 3.9 Security, Audit & Penetration Checks
- [ ] **Distributed Rate Limiter**: Rapid repeated requests to `/api/auth/login` trigger HTTP 429 Too Many Requests.
- [ ] **File Upload Sanitization**: Uploading executable binaries disguised as `.xlsx` or `.png` is rejected by MIME and header inspection.
- [ ] **Immutable Audit Logging**: Actions such as staff invitations, score overrides, and event suspensions record tamper-proof audit rows.
- [ ] **QR Token Cryptography**: Verification tokens cannot be guessed or sequentially enumerated.
