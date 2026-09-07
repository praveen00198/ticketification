# RULES.md — Permanent Engineering Rules & Invariants

## 1. Absolute Priority
The following priorities must be strictly followed in this order:
1. **Correctness**
2. **Data integrity**
3. **Architectural consistency**
4. **Security**
5. **Maintainability**
6. **Testability**
7. **Performance**
8. **UI/UX polish**

Never sacrifice architecture or correctness merely to make something appear to work.

---

## 2. Legacy Code & Data Preservation Policy
- Treat existing code as `LEGACY / UNTRUSTED IMPLEMENTATION`.
- Existing DATA is sacred and separate from code.
- **DO NOT** delete valuable user data.
- **DO NOT** delete Supabase Auth users.
- **DO NOT** drop production-like database tables or run destructive migrations.
- **DO NOT** delete existing Supabase Storage objects.
- **DO NOT** destroy event, guest, or ticket records.

---

## 3. Strict Backend Layering
- **ROUTE**: Endpoint definitions and middleware only. No business logic, no database calls.
- **CONTROLLER**: HTTP concerns, parameter parsing, status code mapping. No DB queries, no file uploads.
- **VALIDATION**: Validates all incoming payloads before reaching business services.
- **SERVICE**: Pure business rules, domain orchestration, transaction coordination. No direct `db` queries.
- **REPOSITORY**: All database interaction via Drizzle ORM. No business decisions, no HTTP objects.
- **PROVIDER / ADAPTER**: Isolates external infrastructure (Puppeteer, Supabase Storage, XLSX).

---

## 4. Database Rules
1. **Explicit ORDER BY**: Every query returning lists MUST include an explicit `ORDER BY`. Never rely on natural or storage order.
2. **Missing Data**: Store missing/optional data as `NULL`. Never store `"N/A"`, `"-"`, or `"0000000000"`.
3. **Atomic Mutations**: Single-use check-ins MUST use conditional database updates (`WHERE id = ? AND status = 'ACTIVE'`).
4. **Relational Constraints**: Use foreign keys, unique constraints, and indexes. Do not rely solely on application-level checks.

---

## 5. Ticket Rendering & Format Rules
1. **PNG Binary Only**:
   - The final ticket asset MUST be a genuine PNG image (`0x89504E47`).
   - NEVER save SVG or rename SVG extensions to `.png`.
2. **Preserve Visual Template**:
   - Use the official visual template (`assets/ticket_template.png`).
   - Guest Name and QR Code are positioned as required.
   - Internal Ticket ID (e.g. `GAN-00001`) MUST NOT be visibly printed on the ticket.
3. **Sanitized Filenames**:
   - Conforms strictly to `<Guest-Name>-<Ticket-ID>.png`.
   - Unassigned worker tickets: `<Ticket-ID>.png`.
   - Never output `undefined.png`, `null.png`, or un-sanitized traversal characters.

---

## 6. Storage & Download Rules
1. **Supabase Storage as Source of Truth**:
   - Canonical bucket: `ticket-images`.
   - Path format: `events/{eventId}/tickets/{filename}.png`.
   - No permanent storage on the local server filesystem.
2. **No Regeneration on Download**:
   - Both individual and bulk downloads MUST reuse existing stored PNG assets.
   - Zero on-demand ticket regeneration during download.
3. **ZIP Format**:
   - Bulk ZIP archive MUST contain ONLY valid PNG ticket files.
   - No SVG, PDF, CSV manifests, or summary text files unless explicitly requested.

---

## 7. No Silent Fallbacks (Zero Tolerance)
- **NO**: Supabase upload fails ➔ save locally and pretend success.
- **NO**: PNG generation fails ➔ rename SVG to `.png` and pretend success.
- **NO**: Database fails ➔ return in-memory mock data.
- **NO**: Ticket asset missing ➔ silently regenerate without authorization.
- Every failure MUST be explicitly surfaced with an appropriate error.

---

## 8. Security & Secrets Rules
1. Never commit secret keys (`SUPABASE_SERVICE_ROLE_KEY`, DB passwords) to Git.
2. `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client bundle.
3. Every event-related endpoint MUST verify ownership: `event.createdBy === authenticatedUserId`.
4. QR codes MUST encode an opaque verification token; NEVER encode raw PII (phone, email).
5. All file uploads must be sanitized and size-limited (max 10MB).

---

## 9. Design System Color Governance
- Strict Rule: **NO RANDOM VIOLET, PURPLE, OR INDIGO COLORS.**
- Primary visual identity is based strictly on:
  - Deep Black / Dark Charcoal (`#09090b`, `#121215`, `#18181b`)
  - Emerald Green / Vivid Green Variants (`#10b981`, `#059669`)
  - Neutral Supporting Scales (Zinc/Slate borders and text)
