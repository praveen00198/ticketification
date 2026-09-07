# DECISION.md — Architecture Decision Records (ADRs)

## ADR-001: Strict Layered Backend Monolith
- **Status**: ACCEPTED
- **Context**: The legacy backend had accumulated logic leaks where route files performed database queries, services executed direct `db.update()` statements, and controllers performed file conversions.
- **Decision**: Enforce a strict 5-layer architecture: `Route` ➔ `Controller` ➔ `Validation` ➔ `Service` ➔ `Repository` ➔ `Database/Storage`.
- **Consequences**: Controllers contain zero business logic; services contain zero raw SQL or Drizzle queries; all database queries live exclusively in repositories; external infrastructure (Puppeteer, Supabase) is isolated in providers.

---

## ADR-002: Real PNG Binary Ticket Rendering via Backend Puppeteer
- **Status**: ACCEPTED
- **Context**: Legacy code generated SVG markup and uploaded `.svg` files to Supabase Storage, requiring client-side canvas conversion hacks or resulting in SVG downloads disguised as `.png`.
- **Decision**: The backend MUST generate real, binary PNG images using a headless browser engine (Puppeteer) and verify the 8-byte PNG header (`0x89504E47`) *before* uploading to Supabase Storage.
- **Consequences**: Storage assets are genuine PNGs. The client downloads pre-rendered PNGs directly without client-side rasterization.

---

## ADR-003: Existing Asset Reuse for Bulk ZIP Exports
- **Status**: ACCEPTED
- **Context**: Legacy bulk export launched Puppeteer instances during the streaming of ZIP files to convert SVGs on the fly, causing server memory exhaustion on large events (1,000+ tickets).
- **Decision**: Bulk download will strictly stream existing, pre-generated PNG assets from Supabase Storage in controlled batches (e.g. 20 concurrent downloads). Zero ticket regeneration during download.
- **Consequences**: Bulk ZIP export memory remains strictly bounded (`O(batch_size)` rather than `O(total_tickets)`). Large events export smoothly.

---

## ADR-004: Atomic Conditional SQL Check-In for Race Prevention
- **Status**: ACCEPTED
- **Context**: In high-concurrency event scenarios, two gate volunteers might scan the same single-use ticket at the same second. Separate `SELECT` then `UPDATE` queries produce double-entry race conditions.
- **Decision**: Check-ins for single-use tickets execute an atomic conditional update:
  `UPDATE tickets SET status = 'USED', updated_at = NOW() WHERE id = $1 AND status = 'ACTIVE' RETURNING id;`
- **Consequences**: Exactly one scanner request succeeds. Simultaneous requests receive `ALREADY_USED`.

---

## ADR-005: Supabase Auth & Server-Side Service Role Key Isolation
- **Status**: ACCEPTED
- **Context**: Bypassing server authentication or leaking service-role keys compromises database integrity.
- **Decision**: Supabase Auth handles user identity. The `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to the backend server. The client bundle receives only `VITE_SUPABASE_ANON_KEY`.
- **Consequences**: Zero trust on client IDs. The backend validates user JWTs and verifies event ownership on every event-scoped mutation.

---

## ADR-006: Dynamic Header Mapping for Excel Imports
- **Status**: ACCEPTED
- **Context**: Organizers use spreadsheets with arbitrary column headers (`Full Name`, `Attendee`, `Mobile`, `Contact Number`).
- **Decision**: Provide an interactive import wizard: analyze headers, present detected mappings with confidence scores, allow custom column mapping, and enforce only `Name` and `Category` by default. Phone and email remain optional.
- **Consequences**: Organizers are not forced into rigid spreadsheet templates.

---

## ADR-007: First-Scan Name Assignment for Reusable Worker Passes
- **Status**: ACCEPTED
- **Context**: Event staff passes are often printed in bulk before specific volunteer names are finalized.
- **Decision**: Worker passes can be created with `guestId = NULL`. On first scan, the scanner UI detects an unassigned worker pass, prompts the admin for the worker's name, creates the guest record, and completes the first check-in in a single atomic transaction. Future scans remain valid as `VALID_WORKER`.
- **Consequences**: Eliminates cumbersome pre-assignment or multi-step manual check-in steps at the gate.

---

## ADR-008: Visual Identity Anchored in Obsidian & Emerald (No Purple/Violet)
- **Status**: ACCEPTED
- **Context**: The application requires a professional, high-contrast, production-grade visual console.
- **Decision**: Standardize on deep blacks, dark charcoals, and vivid emerald green accents. Explicitly ban random purple, violet, or indigo styling.
- **Consequences**: Visual cohesion across all dashboard, table, and scanner interfaces.

---

## ADR-009: Container-Safe Native Sharp Rasterization for Production Ticket Rendering
- **Status**: ACCEPTED
- **Context**: Headless Chromium (Puppeteer) in containerized cloud environments (such as Render Linux containers) requires external shared desktop libraries (`libnss3`, `libatk`, etc.) and cache path persistence (`/opt/render/.cache/puppeteer`). In production, missing browser dependencies caused unhandled process crashes resulting in HTTP 500 errors during ticket generation.
- **Decision**: Adopt native server-side rasterization via `sharp` as the primary engine for converting SVG ticket markup into genuine PNG binaries (`0x89504E47`). `sharp` bundles static `libvips` binaries for Linux x64 and Windows, requires zero browser processes or external GUI libraries, executes in ~15ms per ticket, and satisfies Rule 5.1 (Genuine PNG binary verification) and Rule 5.2 (Visual template preservation).
- **Consequences**: Cloud deployments on Render, AWS, or Docker containers generate genuine high-resolution PNG tickets with zero browser crashes or process memory leaks.

