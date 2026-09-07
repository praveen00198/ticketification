# PRD.md — Product Requirements Document

## 1. Product Overview
**Product Name**: Ticketification  
**Platform**: Production-Grade QR Event Ticketing & Verification Platform  
**Purpose**: Enable event organizers to manage events, import guest lists from Excel with flexible schema mapping, generate cryptographically secured visual PNG tickets embedded with QR codes, upload assets to cloud storage (Supabase Storage), download tickets individually or in bulk, and execute fast, event-scoped mobile check-ins with server-enforced atomic single-use and reusable worker policies.

---

## 2. Core User Workflows

```
ORGANIZER
   │
   ├─► 1. Register / Login (Supabase Auth)
   │
   ├─► 2. Dashboard: View overall event metrics & active events
   │
   ├─► 3. Create Event: Title, Date, Time, Venue, Description
   │
   ├─► 4. Import Guests:
   │      ├─ Upload Excel (.xlsx, .xls, .csv)
   │      ├─ Automatic header detection & confidence scoring
   │      ├─ Interactive column mapping & field requirement selection
   │      ├─ Validation preview & error report
   │      └─ Commit guests to database
   │
   ├─► 5. Ticket Generation:
   │      ├─ Automatic ticket assignment based on category (VIP, Guest, Worker)
   │      ├─ High-resolution visual rendering on provided PNG template (Puppeteer)
   │      ├─ Real PNG binary generation & upload to Supabase Storage
   │      └─ PostgreSQL metadata persistence with unique sequence numbers
   │
   ├─► 6. Ticket Distribution & Downloads:
   │      ├─ Individual download (fetches existing stored PNG asset directly)
   │      └─ Bulk ZIP export (streams existing PNG assets in controlled batches)
   │
   └─► 7. Day-of-Event QR Scanner & Check-In:
          ├─ Mobile camera scan of opaque QR token
          ├─ Server verification: Event scoping, usage rules, status
          ├─ Single-use tickets: Atomic conditional check-in
          ├─ Reusable worker tickets: Check-in audit row, prompt for name on first scan
          └─ Instant scan result (Success, Already Used, Wrong Event, Worker Name Required)
```

---

## 3. Detailed Functional Requirements

### 3.1 Authentication & Authorization
- **FR-AUTH-1**: User registration with email/password via Supabase Auth.
- **FR-AUTH-2**: Secure login with JWT issuance, session persistence, and automatic token refresh.
- **FR-AUTH-3**: Server-side JWT validation middleware on all protected API routes.
- **FR-AUTH-4**: Zero-trust authorization: every event operation checks event ownership (`created_by === authenticated_user_id`).

### 3.2 Event Management
- **FR-EVT-1**: Create, read, update, and list events.
- **FR-EVT-2**: Track event metadata: Name, Date, Time, Venue, Description, Status (UPCOMING, ACTIVE, COMPLETED, CANCELLED).
- **FR-EVT-3**: Auto-seed default ticket categories (`GENERAL`, `VIP`, `WORKER`) on event initialization.

### 3.3 Guest List Excel Import
- **FR-IMP-1**: Upload Excel workbooks (`.xlsx`, `.xls`, `.csv`) up to 10MB.
- **FR-IMP-2**: Dynamically detect column headers; do NOT hardcode column names or order.
- **FR-IMP-3**: Support minimum required fields: `Name`, `Category`. Phone and email must remain strictly optional unless the organizer marks them required.
- **FR-IMP-4**: Map detected columns to internal fields (`name`, `category`, `phone`, `email`, `organization`, `designation`, `count`).
- **FR-IMP-5**: Preview parsed rows with validation highlights before committing to the database.

### 3.4 Ticket Generation & PNG Rendering
- **FR-TCK-1**: Render high-resolution ticket cards onto the official template (`assets/ticket_template.png`).
- **FR-TCK-2**: Final stored asset MUST be genuine PNG binary format (header `0x89504E47`). No SVGs or fake extensions.
- **FR-TCK-3**: Overlaid elements: Guest Name and QR Code. Ticket ID (e.g. `GAN-00001`) must NOT be visibly printed on the image.
- **FR-TCK-4**: QR code must encode an opaque 64-character token URL (`https://APP_DOMAIN/verify/<TOKEN>`), never raw PII.
- **FR-TCK-5**: Upload rendered PNGs directly to Supabase Storage in the `ticket-images` bucket under `events/{eventId}/tickets/{filename}.png`.
- **FR-TCK-6**: Persist ticket metadata in PostgreSQL only after storage upload succeeds.

### 3.5 Ticket Downloads
- **FR-DL-1**: Canonical filename format: `<Guest-Name>-<Ticket-ID>.png` (e.g. `Rahul-Sharma-GAN-00001.png`). Unassigned workers: `<Ticket-ID>.png` (e.g. `GAN-00001.png`).
- **FR-DL-2**: Filenames must be sanitized: remove slashes, path traversal sequences (`..`), and invalid filesystem characters.
- **FR-DL-3**: Individual download must fetch the existing stored PNG asset directly. No on-demand ticket regeneration.
- **FR-DL-4**: Bulk export must stream a ZIP archive containing ONLY genuine PNG ticket files.
- **FR-DL-5**: Bulk export must process files in controlled batches with bounded memory usage (supporting 3,000+ tickets).

### 3.6 Day-of-Event Verification & Check-In
- **FR-SCN-1**: Mobile-first QR camera scanner with rapid scan cycle.
- **FR-SCN-2**: Authoritative server-side verification: check token validity, event scoping, and ticket status.
- **FR-SCN-3**: Atomic check-in for single-use tickets (`VIP`, `Guest`): conditional SQL update ensures two simultaneous scans can never both succeed.
- **FR-SCN-4**: Reusable worker tickets: accept repeated scans, record check-in history. If unassigned, prompt for worker name on first scan, save name, and complete check-in in a single coherent flow.
- **FR-SCN-5**: Clear scan result states:
  - `SUCCESS`: Valid ticket, checked in.
  - `ALREADY_USED`: Single-use ticket was already checked in earlier.
  - `INVALID`: Unknown token or tampering detected.
  - `WRONG_EVENT`: Ticket belongs to a different event.
  - `REUSABLE` / `VALID_WORKER`: Worker pass accepted again.
  - `WORKER_NAME_REQUIRED`: Unassigned worker pass awaiting name entry.

---

## 4. Non-Functional Requirements
- **NFR-1 (Integrity)**: Zero silent fallbacks. Failures in rendering, storage, or DB must return clear structured errors.
- **NFR-2 (Performance)**: QR verification round-trip under 250ms on mobile 4G network.
- **NFR-3 (Scalability)**: Efficient batching for ticket generation and bulk ZIP downloads of up to 5,000 tickets without server memory exhaustion.
- **NFR-4 (Security)**: Full zero-trust event scoping; service role credentials isolated strictly on the server; zero PII in QR payloads.
