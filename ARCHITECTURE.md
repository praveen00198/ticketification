# ARCHITECTURE.md — System Architecture & Design

## 1. Architectural Overview
Ticketification is designed as a **Modular Monolith** with strict separation of concerns, defensive security boundaries, and isolated infrastructure providers.

```
+─────────────────────────────────────────────────────────────+
|               REACT 18 / VITE FRONTEND                      |
|  Pages ──► Feature Components ──► Context ──► API Client    |
+──────────────────────────────┬──────────────────────────────+
                               │ HTTPS / REST (JSON)
+──────────────────────────────▼──────────────────────────────+
|              EXPRESS / TYPESCRIPT BACKEND                   |
|                                                             |
|  [Route Layer]                                              |
|    - Route definitions, authMiddleware, validation          |
|         │                                                   |
|  [Controller Layer]                                         |
|    - Request parsing, response serialization, HTTP status   |
|         │                                                   |
|  [Service Layer]                                            |
|    - EventService, GuestService, TicketService              |
|    - VerificationService, CheckInService, DownloadService   |
|         │                                                   |
|  [Repository & Provider Layer]                              |
|    - Drizzle ORM Repositories (Isolated DB Access)          |
|    - StorageService (Supabase Storage Provider)             |
|    - TicketRenderingService (Puppeteer Headless Provider)   |
+──────────────────────────────┬──────────────────────────────+
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
+─────────────────────────+          +─────────────────────────+
|   SUPABASE POSTGRESQL   |          |    SUPABASE STORAGE     |
|   (Relational Data)     |          |  (bucket: ticket-images)|
+─────────────────────────+          +─────────────────────────+
```

---

## 2. Mandatory Backend Layering Rules

```
REQUEST ──► ROUTE ──► CONTROLLER ──► VALIDATION ──► SERVICE ──► REPOSITORY ──► DATABASE
                                                      │
                                                      └──► PROVIDER ──► EXTERNAL SERVICE
```

1. **Route Layer**:
   - Defines endpoints and attaches `authMiddleware` and input validation.
   - Contains NO database queries or business decisions.
2. **Controller Layer**:
   - Extracts typed parameters from `req` (`params`, `query`, `body`, `user`).
   - Calls the respective service method.
   - Returns standard HTTP responses (`200`, `201`, `400`, `401`, `404`, `409`, `500`).
   - Contains NO database logic or direct storage access.
3. **Service Layer**:
   - Houses business logic, authorization verification, state transitions, and coordination.
   - MUST NOT call `db.select()`, `db.insert()`, or `db.update()` directly.
   - Delegates all database access to Repositories.
   - Delegates external infrastructure calls (Puppeteer, Supabase Storage, XLSX) to Providers.
4. **Repository Layer**:
   - Encapsulates Drizzle ORM queries against PostgreSQL.
   - ALL queries returning multiple records MUST declare explicit `.orderBy()`.
   - Never exposes HTTP concepts or handles responses.
5. **Provider Layer**:
   - Isolates external systems: `SupabaseStorageProvider`, `TicketRenderer` (Puppeteer), `ExcelParser` (XLSX).

---

## 3. Database Schema (PostgreSQL + Drizzle ORM)

### Tables & Relationships
```
users (id [Supabase Auth UUID], name, email, role, created_at, updated_at)
  │
  ├──< events (id, name, date, time, venue, description, status, created_by, created_at, updated_at)
        │
        ├──< guest_imports (id, event_id, file_name, total_rows, valid_rows, status, created_by)
        │
        ├──< guests (id, event_id, name, email, phone, organization, designation, category, import_id)
        │     │
        ├──< ticket_types (id, event_id, name, label, usage_policy, created_at)
        │     │
        └──< tickets (id, event_id, guest_id, ticket_type_id, verification_token, status,
              │        usage_policy, asset_path, asset_url, sequence_number, created_by)
              │
              └──< ticket_checkins (id, ticket_id, event_id, checked_in_at, verified_by, worker_name_assigned)
```

### Relational Constraints & Indexes
- `tickets`: Unique constraint on `(event_id, sequence_number)` ensuring contiguous, collision-free numbering.
- `tickets`: Unique constraint on `verification_token` ensuring tamper-proof QR lookup.
- `tickets`: Indexes on `event_id`, `verification_token`, `guest_id`, `status`.
- `ticket_checkins`: Foreign key to `tickets(id)` with `ON DELETE cascade`, index on `ticket_id`, `event_id`, `checked_in_at`.
- `ticket_types`: Unique constraint on `(event_id, name)`.

---

## 4. Transaction Boundaries & Concurrency

### 4.1 Atomic Single-Use Check-In
To eliminate race conditions when two scanners scan the same single-use ticket simultaneously:
```sql
UPDATE tickets
SET status = 'USED', updated_at = NOW()
WHERE id = :ticketId
  AND status = 'ACTIVE'
  AND usage_policy = 'SINGLE_USE'
RETURNING id;
```
- If rows returned === 1: Ticket check-in succeeded. Insert audit row into `ticket_checkins`.
- If rows returned === 0: Ticket is already used or cancelled. Fetch prior check-in timestamp and return `ALREADY_USED`.

### 4.2 Worker Name Assignment & First Check-In
When an unassigned worker ticket is first scanned and the organizer assigns a name:
```ts
await db.transaction(async (tx) => {
  // 1. Create Guest Record
  const [guest] = await tx.insert(guests).values({
    eventId: ticket.eventId,
    name: assignedName,
    category: 'WORKER'
  }).returning();

  // 2. Link Guest to Ticket
  await tx.update(tickets).set({
    guestId: guest.id,
    updatedAt: new Date()
  }).where(eq(tickets.id, ticket.id));

  // 3. Insert Check-In Audit Log
  await tx.insert(ticketCheckins).values({
    ticketId: ticket.id,
    eventId: ticket.eventId,
    verifiedBy: scannerAdmin,
    workerNameAssigned: assignedName
  });
});
```

---

## 5. Storage Architecture (Supabase Storage)

- **Bucket**: `ticket-images` (Public bucket, CDN cached).
- **Object Path Hierarchy**:
  ```
  events/
    {eventId}/
      tickets/
        {GuestName}-{TicketId}.png
  ```
- **Validation**:
  - Every uploaded buffer must be checked for the 8-byte PNG signature: `89 50 4E 47 0D 0A 1A 0A`.
  - Stored asset MIME type: `image/png`.
  - Zero storage of SVG files.
- **Error Handling**: If Supabase Storage upload fails, ticket creation aborts and rolls back. Never fall back to local disk storage.

---

## 6. API Route Contracts

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new admin user | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT | Public |
| `GET` | `/api/events` | List events for authenticated user | Yes |
| `POST` | `/api/events` | Create new event | Yes |
| `GET` | `/api/events/:id` | Get event details | Yes |
| `POST` | `/api/guests/events/:eventId/upload` | Upload & analyze Excel headers | Yes |
| `POST` | `/api/guests/events/:eventId/import` | Validate & commit imported guests | Yes |
| `POST` | `/api/tickets/events/:eventId/generate` | Generate PNG tickets for guests | Yes |
| `POST` | `/api/tickets/events/:eventId/generate-worker` | Generate unassigned worker tickets | Yes |
| `GET` | `/api/tickets/events/:eventId` | List tickets with filters & pagination | Yes |
| `GET` | `/api/tickets/:id/download` | Download single ticket PNG | Yes |
| `GET` | `/api/tickets/events/:eventId/export-zip` | Stream bulk ZIP containing PNGs | Yes |
| `POST` | `/api/verify/scan-and-checkin` | Verify QR token & atomic check-in | Yes |
| `GET` | `/api/verify/events/:eventId/recent` | Get live scanner check-in feed | Yes |
