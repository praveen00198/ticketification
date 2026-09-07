# PROJECT_CONTEXT.md — Project Memory & Status

## Project Overview
QR Ticket Generation & Verification Platform for operational event management. Allows admin registration/login, event creation, guest list import from Excel with smart column mapping, batch ticket image & QR generation via Puppeteer, Supabase Storage for assets, and mobile-first QR scanning for event-day check-in with worker reusable ticket support.

## Current Phase
**Complete Platform Build (Phases 0 through 8 Complete)**

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Remix Icon / Lucide, html5-qrcode |
| Backend | Node.js, Express, TypeScript |
| ORM | Drizzle ORM (`postgres.js` driver) |
| Database | Supabase PostgreSQL (7 tables, explicit relations, indexes) |
| Storage | Supabase Storage (`supabase-admin` SDK) |
| Auth | Supabase Auth (JWT validation middleware) |
| Ticket Rendering | Puppeteer (1620×2025 PNG) with SVG high-resolution fallback, qrcode library |
| Archiving | `archiver` for bulk ZIP generation with embedded CSV manifests |

## Architecture
Modular monolith: `routes → controllers → services → repositories`

### Server Modules
```
server/src/modules/
├── auth/              # Supabase Auth integration & JWT middleware
├── users/             # User profile synchronization
├── events/            # Event CRUD with ownership & ticket types
├── guests/            # Guest records & smart 5-step import pipeline
├── tickets/           # Ticket data model, sequence engine, SVG/Puppeteer rendering
└── verification/      # 7-state token lookup, atomic check-in, worker staff assignment
```

## Database
Supabase PostgreSQL with Drizzle ORM. Tables: `users`, `events`, `ticket_types`, `guests`, `tickets`, `ticket_checkins`, `guest_imports`.

**Critical Rule**: ALL queries returning ordered results MUST use explicit ORDER BY.

## Business Rules
### Ticket Types & Usage Policy
- **VIP / GUEST**: `SINGLE_USE` — one successful check-in, then permanently USED
- **WORKER**: `REUSABLE` — can check in multiple times, each recorded in `ticket_checkins`
- Types are extensible (`GENERAL`, `VIP`, `WORKER`, `SPEAKER`, `ORGANIZER`, plus custom event-level types)

### Ticket Lifecycle
- `ACTIVE` → check-in → `USED` (single-use) or stays `ACTIVE` (reusable)
- `ACTIVE` → `CANCELLED` (admin action)
- No sequential ticket ID displayed to the public. Only verification token via QR (`https://APP_DOMAIN/verify/<SECURE_TOKEN>`).

### Worker Tickets
- Can be created without a guest name (`guest_id = NULL`)
- On first scan of unassigned ticket, scanner prompts for staff name assignment
- Assignment persists across future scans

### Verification
- QR contains `https://APP_DOMAIN/verify/<SECURE_TOKEN>`
- Token is cryptographically secure (`crypto.randomBytes(32).toString('hex')` 64-char string)
- Verification checks: token validity → event match → ticket status → usage policy
- Responses: `VALID`, `VALID_WORKER`, `UNASSIGNED_WORKER`, `ALREADY_USED`, `WRONG_EVENT`, `CANCELLED`, `INVALID`

### Check-in Atomicity
- Single-use: `UPDATE tickets SET status='USED' WHERE id=$1 AND status='ACTIVE'` — exactly one concurrent request succeeds (race-condition proof)
- Reusable: INSERT into `ticket_checkins` without mutating ticket status

## Storage Strategy
Supabase Storage bucket (`ticket-images`) with event-scoped paths: `events/<event-id>/tickets/ticket-<displayId>.svg`.
- Vector SVG tickets generated purely in memory.
- Ephemeral local disk writes and `/uploads/` URLs on Render are eliminated.
- Supabase upload is verified before PostgreSQL insertion.
- Existing tickets with legacy `/uploads/` paths are automatically synced/backfilled to Supabase Storage.

## Completed Work
- [x] Phase 0: Repository inspection, risk analysis, documentation suite in `docs/`
- [x] Phase 1: Foundation, Drizzle ORM schema & migrations, Supabase Auth integration, `.env.example` templates
- [x] Phase 2: Event CRUD, strict user ownership enforcement (403 Forbidden), default ticket types provisioning
- [x] Phase 3: Smart Guest Import with 5-step wizard, dynamic header detection, column & category mapping, validation engine
- [x] Phase 4: Deterministic ticket generation, 64-char crypto tokens, sequence numbering (`#00001`), unassigned worker passes, in-memory 1620×2025 vector SVG generation
- [x] Phase 5: Verification engine supporting all 7 states, atomic check-in, worker staff assignment, recent check-ins stream
- [x] Phase 6: Mobile-friendly camera scanner (`html5-qrcode`), audio/haptic feedback, manual token fallback, public verification portal
- [x] Phase 7: Bulk ZIP export (`GET /api/tickets/events/:eventId/export-zip`) with embedded CSV manifest
- [x] Phase 8: Testing suite (`tests/verification.test.ts` & `tests/excelValidation.test.ts` passing 100%), strict TypeScript build verification (client & server)
- [x] Phase 9: Forensic Audit & Fix of Storage Architecture:
  - Eliminated ephemeral disk writes in `TicketImageService`.
  - Enforced Supabase Storage upload with error bubbling in `SupabaseStorageService`.
  - Pre-upload verification before database commit in `TicketService`.
  - Backfill migration logic for existing tickets.
  - Hardened camera lifecycle & device selection in `QrScanner`.
- [x] Phase 10: Targeted Fixes for Bulk Ticket Download & Automatic Check-In:
  - Stream all event ticket files directly from Supabase Storage in memory-conscious streaming batches without local disk dependencies.
  - Safe filename sanitization with deduplication (`<Name>.svg`, `<Name>-2.svg`) and archive naming `<Event-Name>-Tickets.zip`.
  - Single atomic `POST /api/verify/scan` endpoint: camera scan atomically checks in guest, guards against race-condition double check-in, and renders immediate status banner without manual button clicks or scrolling.
  - Full unit & integration test coverage (11/11 tests passing in Jest, client and server builds clean).

