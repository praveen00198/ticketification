# RULES.md — Permanent Engineering Rules & Invariants

## 1. Absolute Priority Hierarchy
When making any architectural, engineering, or design trade-off, prioritize in this strict order:
1. **Security & Authorization Boundaries**
2. **Data Integrity & Consistency**
3. **Correctness & Reliability**
4. **Architectural Layering & Boundaries**
5. **Maintainability & Clean Code**
6. **Testability & Test Coverage**
7. **Resource Efficiency (Memory/Storage/Bandwidth)**
8. **UI/UX Polish**

Never bypass security or architecture merely to make a prototype appear functional.

---

## 2. Authentication & Authorization Rules
1. **Authentication ≠ Authorization**: Supabase Auth only identifies *who* a user is (`uid`). It never determines *what* they are allowed to do.
2. **Backend is the Sole Security Boundary**: Frontend route guards, hidden buttons, and `localStorage` states are UX conveniences only. The backend MUST validate authorization on every single request.
3. **Never Trust Frontend Roles**: Never read or trust role strings sent from the client or stored in browser storage.
4. **No Default Admin Assignment**: Every newly registered user receives the platform role `USER`. The platform role `ADMIN` or `SUPER_ADMIN` can only be granted via platform operations.
5. **Event-Scoped Permissions**: All organizer, staff, and evaluator permissions are scoped strictly to specific events via `event_members`. A user who is a `HOST` in Event A is a standard `USER` in Event B.
6. **Least Privilege**: Users only receive the exact permissions required for their assigned role (e.g. volunteers do not have scanning permissions unless explicitly assigned).

---

## 3. Data Ownership & Event Isolation Rules
1. **Explicit Event Scoping**: Every query accessing attendees, credentials, teams, evaluations, or members MUST include `{ eventId }` in the query predicate.
2. **IDOR Prevention**: Always verify that the authenticated user owns the event or has an active membership with the required permission before returning or mutating event-scoped data.
3. **Cross-Event Data Leakage**: It is strictly forbidden for data from Event A to appear in responses for Event B, even if the same user has roles in both events.

---

## 4. Database & Storage Architecture Rules
1. **MongoDB for Application Documents**: All users, events, memberships, teams, evaluations, credential metadata, and audit logs are stored in MongoDB.
2. **Supabase Storage for Files**: All images, PDFs, spreadsheets, and ZIP archives are stored in Supabase Storage.
3. **Zero Binaries in Database**: MongoDB MUST NEVER store binary buffers, base64 data URLs, or files larger than 100KB.
4. **Zero Ephemeral Local Files**: Never rely on local server disk (`/tmp` or `uploads/`) for persistent assets. Render containers wipe local files on restart.
5. **No On-Demand Regeneration on Download**: Ticket downloads and exports MUST fetch pre-existing stored PNG assets. Never re-render tickets during downloads.
6. **Explicit Query Ordering**: Every query returning lists MUST include an explicit sort order (e.g. `.sort({ createdAt: -1 })`). Never rely on natural collection order.
7. **Explicit Nulls**: Store missing optional values as `null` or omit fields cleanly. Never store `"N/A"`, `"-"`, or `"undefined"`.

---

## 5. Concurrency, Atomicity & Transactions
1. **Atomic Single-Use Check-In**: High-concurrency check-ins MUST use conditional atomic updates (`findOneAndUpdate` matching `{ status: 'ACTIVE' }`). Never perform separate `find()` then `save()`.
2. **Double-Scan Guarantee**: If two scanners scan the same single-use credential at the exact same millisecond, exactly ONE scan must succeed; the other must return `ALREADY_CHECKED_IN`.
3. **Idempotent Mutations**: All state transitions (e.g. payment confirmations, check-ins, invitation acceptances) must be idempotent and safe to retry without side effects.
4. **Unique Constraints**: Enforce uniqueness at the database engine level (e.g. unique compound index on `{ eventId, sequenceNumber }` and unique index on `verificationToken`).

---

## 6. Asynchronous Jobs & Scalability Rules
1. **No Heavy Work in HTTP Requests**: Never generate 50+ credentials, process large Excel files, or compress bulk ZIP archives inside a synchronous HTTP request.
2. **Asynchronous Job Pattern**: Heavy operations must immediately return `202 Accepted` with a `jobId` and execute in background workers.
3. **Controlled Concurrency on 512MB RAM**:
   - Limit Sharp image processing concurrency to `concurrency(1)`.
   - Disable libvips native buffer caching with `sharp.cache(false)`.
   - Batch size for image generation must not exceed 2 tickets per batch.
   - Explicitly dereference image buffers immediately after upload to allow garbage collection.
4. **Direct Object Storage Uploads**: Large file uploads (Excel sheets > 5MB) must use presigned direct upload URLs to Supabase Storage, bypassing Node memory entirely.

---

## 7. Credential Rendering & QR Security Rules
1. **Real PNG Binaries Only**: Rendered credentials must be authentic PNG binaries (header bytes `0x89504E47`). Never rename SVGs to `.png`.
2. **No PII in QR Codes**: QR codes encode ONLY an opaque 64-character verification URL (`https://ticketification.app/verify/<TOKEN>`). Never encode attendee names, emails, phones, or government IDs.
3. **No Sequential Numbers on Front of Passes**: The public credential image must NOT display sequential internal database IDs to prevent enumeration attacks.
4. **Deterministic Font Shaping**: Complex script fonts (e.g. Devanagari/Hindi `NotoSansDevanagari-Bold.ttf`) must be bundled in `assets/fonts/` and embedded as base64 in SVG templates.

---

## 8. Payment & Gateway Webhook Rules
1. **Never Trust Frontend Payment Success**: The client route `/payment/success` is NEVER proof of payment.
2. **Webhook Verification**: Payment status is updated ONLY when a cryptographic signature-verified webhook is received directly from the payment gateway.
3. **Webhook Idempotency**: Payment webhooks must track gateway event IDs to prevent duplicate crediting or credential issuance on network retries.
4. **Zero Card Data**: Ticketification servers MUST NEVER touch, log, or store raw credit card numbers or CVVs.

---

## 9. Rate Limiting, Security & Privacy Rules
1. **Distributed Rate Limiting**: Enforce endpoint-aware rate limiting across all public and sensitive routes (Login: strict, Registration: strict, QR scan: high capacity, Export: strict).
2. **Invitation Security**: Team invitations must use cryptographically secure, single-use tokens with a 72-hour expiry. Never email autogenerated passwords.
3. **Data Minimization & Least Privilege**:
   - Attendees only view their own credentials and teams.
   - Evaluators only view assigned teams and blind scorecards.
   - Mentors only view assigned team projects.
   - Volunteers only view assigned tasks and scanning interfaces if permitted.
4. **Immutable Audit Trails**: Every administrative mutation, score override, invitation, and suspension MUST write an immutable audit log entry capturing actor, event, action, target, metadata, and timestamp.
5. **Suspension Circuit Breakers**: If an event or host is suspended, the backend must immediately block registration, ticket sales, credential generation, and public display.

---

## 10. Error Handling & Zero Silent Fallbacks
1. **Zero Silent Fallbacks**:
   - Never save files locally if Supabase Storage fails.
   - Never serve SVGs as PNGs if rasterization fails.
   - Never return dummy success if an email or database write fails.
2. **Explicit Error Codes**: All errors must return standardized JSON payloads:
   ```json
   {
     "success": false,
     "error": {
       "code": "PERMISSION_DENIED",
       "message": "User does not have permission to scan credentials for this event."
     }
   }
   ```
3. **No Information Leaks**: Error messages in production must never expose stack traces, database connection strings, internal table names, or raw SQL/Mongo queries.
