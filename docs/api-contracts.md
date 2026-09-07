# REST API Contracts

## Base URL
`/api`

## Authentication
All endpoints except `/api/auth/*` and `/api/health` require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

---

## Auth Module

### POST /api/auth/register
Register a new admin account.
```json
// Request
{ "name": "Rahul Sharma", "email": "rahul@example.com", "password": "SecurePass123" }

// Response 201
{ "success": true, "data": { "user": { "id": "uuid", "name": "Rahul Sharma", "email": "rahul@example.com", "role": "ADMIN" }, "token": "supabase_jwt" } }
```

### POST /api/auth/login
```json
// Request
{ "email": "rahul@example.com", "password": "SecurePass123" }

// Response 200
{ "success": true, "data": { "user": { ... }, "token": "supabase_jwt" } }
```

### GET /api/auth/me
Returns current authenticated user profile.

---

## Events Module

### GET /api/events
List all events owned by the authenticated user. Ordered by `created_at DESC`.

### POST /api/events
Create a new event.
```json
{ "name": "Tech Summit 2026", "date": "2026-10-15", "time": "09:00", "venue": "Convention Center", "description": "Annual tech event", "organizerName": "Rahul Sharma" }
```

### GET /api/events/:eventId
Get event details. Returns 403 if not owned by authenticated user.

### PUT /api/events/:eventId
Update event details.

### DELETE /api/events/:eventId
Delete/archive event.

---

## Guest Import Module (Smart Import Wizard)

### POST /api/events/:eventId/guest-import/upload
Upload Excel/CSV file. Returns file metadata.
- Multipart form data with `file` field
- Accepts: `.xlsx`, `.xls`, `.csv`

### POST /api/events/:eventId/guest-import/analyze
Analyze uploaded file.
```json
// Response
{ "headers": ["Full Name", "Mobile", "Email", "Guest Type"],
  "rowCount": 1428,
  "sampleRows": [...],
  "detectedMappings": { "Full Name": "name", "Mobile": "phone", ... },
  "columnStatistics": { ... } }
```

### POST /api/events/:eventId/guest-import/validate
Validate with user-configured mapping.
```json
// Request
{ "importId": "uuid",
  "columnMapping": { "Full Name": "name", "Mobile": "phone", "Guest Type": "category" },
  "requiredFields": ["name", "category"],
  "categoryMapping": { "Staff": "WORKER", "VIP": "VIP" } }

// Response
{ "validRows": 1390, "invalidRows": 6, "warnings": 32, "duplicates": 14,
  "summary": { ... }, "invalidRowDetails": [...] }
```

### POST /api/events/:eventId/guest-import/confirm
Execute the import — creates guest records.
```json
// Request
{ "importId": "uuid", "skipDuplicates": true }

// Response
{ "imported": 1390, "skipped": 14, "errors": 6 }
```

---

## Guests Module

### GET /api/events/:eventId/guests
List guests for an event. Ordered by `created_at DESC`.

### POST /api/events/:eventId/guests
Create a single guest manually.

---

## Tickets Module

### POST /api/events/:eventId/tickets/generate
Generate tickets for selected guests or by category.
```json
{ "guestIds": ["uuid1", "uuid2"] }
// or
{ "category": "VIP" }
```

### POST /api/events/:eventId/worker-tickets/generate
Generate N unassigned worker tickets.
```json
{ "count": 50 }
```

### GET /api/events/:eventId/tickets
List tickets for an event. Ordered by `sequence_number ASC`.

### GET /api/tickets/:ticketId/download
Download individual ticket image.

### POST /api/events/:eventId/tickets/download-zip
Download all tickets as ZIP.

### POST /api/tickets/:ticketId/regenerate
Regenerate ticket image (same verification token).

---

## Verification Module

### POST /api/verification/scan
Verify a ticket token.
```json
// Request
{ "token": "secure-verification-token", "eventId": "uuid" }

// Response (examples)
{ "status": "VALID", "ticket": { "guestName": "Rahul", "category": "VIP", "ticketId": "uuid" } }
{ "status": "ALREADY_USED", "ticket": { "guestName": "Rahul", "usedAt": "2026-10-15T09:12:00Z" } }
{ "status": "VALID_WORKER", "ticket": { "guestName": "Amit", "category": "WORKER" } }
{ "status": "UNASSIGNED_WORKER", "ticket": { "ticketId": "uuid", "category": "WORKER" } }
{ "status": "INVALID" }
{ "status": "WRONG_EVENT" }
```

---

## Check-in Module

### POST /api/tickets/:ticketId/check-in
Atomic check-in. For single-use tickets, this is a one-time operation.
```json
// Request
{ "verifiedBy": "Admin Scanner" }
```

### POST /api/tickets/:ticketId/assign-worker
Assign a name to an unassigned worker ticket.
```json
{ "name": "Rahul Sharma" }
```

### GET /api/events/:eventId/checkins
List all check-ins for an event. Ordered by `checked_in_at DESC`.

---

## Dashboard Module

### GET /api/events/:eventId/dashboard/stats
```json
{ "totalTickets": 1400,
  "byCategory": { "VIP": 50, "GUEST": 1300, "WORKER": 50 },
  "generated": 1400, "assigned": 1380, "unassigned": 20,
  "checkins": { "total": 890, "vip": 45, "guest": 830, "worker": 15 },
  "recentCheckins": [...] }
```

---

## Health

### GET /api/health
```json
{ "status": "OK", "system": "Ticketification Platform", "timestamp": "..." }
```

## Error Response Format
```json
{ "success": false, "error": { "message": "Descriptive error message.", "details": { ... } } }
```
