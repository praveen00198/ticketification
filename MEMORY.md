# MEMORY.md — Operational Knowledge & Audit Discoveries

## 1. Context & Architectural Memory
This file records critical discoveries, anti-patterns, and institutional knowledge identified during the Phase 0 codebase audit. Future engineering work must consult this memory before designing or modifying components.

---

## 2. Critical Bugs & Regressions Discovered in Legacy Code

### 2.1 The SVG vs. PNG Silent Fallback Trap
- **Issue**: In `server/src/modules/tickets/services/ticket.service.ts` (lines 144–146), ticket generation generated SVG markup and uploaded `.svg` files to Supabase Storage.
- **Consequence**: When users clicked download, the frontend attempted to dynamically convert the SVG to a PNG blob client-side using an HTML5 `<canvas>`. When that failed, it opened the raw SVG in a new tab.
- **Root Cause**: The generation pipeline lacked a headless rasterization step before storage upload.
- **Invariant**: Generated tickets MUST be converted to genuine PNG binaries (header `0x89504E47`) on the backend via Puppeteer *before* uploading to Supabase Storage. The storage bucket must contain only `.png` assets.

### 2.2 Re-Rendering During Bulk ZIP Downloads
- **Issue**: In `streamTicketsZip`, the legacy code attempted to detect if a file was SVG and launched a Puppeteer browser instance *during the ZIP export stream* to rasterize on the fly.
- **Consequence**: For events with 1,000+ tickets, launching Puppeteer during export caused massive memory spikes, CPU throttling, and connection timeouts.
- **Invariant**: Bulk download MUST strictly stream *pre-existing* PNG assets from Supabase Storage. Never regenerate tickets during export.

### 2.3 Non-PNG Files Stuffed into Download ZIPs
- **Issue**: The ZIP streaming utility was appending `tickets-manifest.csv` and `export-summary.txt` into the archive, and in failure cases appended raw SVG buffers with `.png` extensions.
- **Invariant**: Bulk ZIP export archives must contain ONLY valid PNG ticket files. Zero SVGs, zero text manifests.

### 2.4 Duplicate Route Mount in Express `app.ts`
- **Issue**: In `server/src/app.ts`:
  ```ts
  app.use('/api/tickets', verificationRoutes);
  app.use('/api/tickets', ticketRoutes);
  ```
  `/api/tickets` was mounted twice, causing route collisions and unpredictable handler execution between verification endpoints and ticket management endpoints.
- **Invariant**: Strict route namespace separation:
  - `/api/verification` ➔ Verification routes (`/scan-and-checkin`, `/recent`)
  - `/api/tickets` ➔ Ticket management routes (`/events/:eventId`, `/generate`, `/export-zip`)

### 2.5 Direct Database Queries Inside Service Layer
- **Issue**: In `server/src/modules/verification/services/verification.service.ts` (lines 482–489), `db.update(tickets)` was called directly inside the service method, completely bypassing the repository layer.
- **Invariant**: All database operations must be isolated in repositories. Services coordinate business workflows and call repository methods.

### 2.6 In-Memory Map in Multi-Step Excel Import
- **Issue**: In `server/src/modules/guests/services/guest-import.service.ts` (line 64), uploaded file rows were stored in an in-memory `Map<string, ...>` between the upload step and commit step. If the server restarted or scaled horizontally, the upload session was lost.
- **Invariant**: Import session state and parsed rows must be tracked via the `guest_imports` database table, enabling stateless, resumable import workflows.

### 2.7 Service Role Key Fallback Security Risk
- **Issue**: In `server/src/config/env.ts` (line 47), `supabaseServiceRoleKey` fell back to `SUPABASE_ANON_KEY` if the service role key was missing.
- **Consequence**: Bypassing missing credentials resulted in silent permission failures in backend storage operations without explicit error messages.
- **Invariant**: If `SUPABASE_SERVICE_ROLE_KEY` is missing in the environment, the server must fail fast with an explicit configuration error.

### 2.8 The Puppeteer / Chromium Container Failure on Render
- **Issue**: On Render's Linux container environment, ticket generation failed with HTTP 500 (`Error: Could not find Chrome` / missing `/opt/render/.cache/puppeteer` / missing Linux `.so` libraries).
- **Consequence**: When users clicked "Generate All Tickets", the backend attempted to launch Puppeteer, which crashed and returned a generic 500 error to the frontend.
- **Root Cause**: Minimal Linux containers do not retain Puppeteer browser cache paths or provide desktop GUI shared libraries (`libnss3`, `libatk`, etc.).
- **Resolution**: Replaced browser-dependent rendering with native server-side `sharp` rasterization. Sharp uses pre-compiled static native binaries with zero external shared library dependencies, generating 1620x2025 genuine PNG binaries (`0x89504E47`) in ~15ms with 100% container resilience.
- **Invariant**: Backend ticket generation must NOT rely on external browser processes in cloud containers. All image rasterization must use self-contained native engines with standard PNG header verification.

### 2.9 Devanagari / Hindi Complex Script Font Bundling
- **Issue**: Devanagari text (e.g. `|| श्री गणेशाय नमः ||`, guest names in Hindi) was rendering with broken/corrupted glyphs and disjoined matras in generated PNG tickets.
- **Root Cause**: Server-side rasterization (`librsvg` / Pango) runs offline and does not fetch external CSS `@import` web fonts. Minimal Linux container hosts (Render) have no Indic fonts installed in `/usr/share/fonts`.
- **Resolution**: Bundled official Google `NotoSansDevanagari-Bold.ttf` inside `assets/fonts/` and embedded the font binary as base64 within `@font-face` inside the SVG markup. Pango and HarfBuzz read the embedded OpenType tables directly from memory, performing flawless Devanagari text shaping, conjunct resolution (`श्री`, `प्र`, `क्ष`, `त्र`), and matra positioning across all operating systems.
- **Invariant**: Any custom or complex script font required by ticket templates MUST be bundled in `assets/fonts/` and embedded directly into the SVG to guarantee deterministic rendering independent of OS system fonts.

### 2.10 Memory Optimization for Render 512MB RAM Containers
- **Issue**: Under bulk ticket generation on Render, the backend process was terminated by the Linux OOM killer with `"Ran out of memory (used over 512MB) while running your code."`
- **Root Cause**:
  1. Default `sharp.cache(true)` retained decompressed image buffers and intermediate surfaces in native C++ memory across operations. Because this was outside V8 heap, Node GC did not trigger, causing RSS to continuously climb past 512MB.
  2. The 1620x2025 background PNG was base64-encoded into the SVG markup (~373KB base64 string), forcing `librsvg` to decode a 13.1 MB RGBA buffer per ticket alongside Cairo surfaces (~40MB RAM per ticket).
  3. `BATCH_SIZE = 5` in `Promise.all` allocated 5 × ~40MB = ~200MB of native RAM simultaneously, causing peak RSS spikes to 378MB+ for just 20 tickets.
- **Resolution**:
  1. Disabled libvips caching via `sharp.cache(false)` and constrained thread pool via `sharp.concurrency(1)` to eliminate native buffer accumulation.
  2. Pre-loaded `templateBuffer` once at startup and used Sharp's native `.composite([{ input: overlaySvg }])`, dropping the SVG payload from ~950KB to ~280KB and eliminating nested PNG decoding inside librsvg.
  3. Bounded batch concurrency to `BATCH_SIZE = 2` and explicitly dereferenced PNG buffers immediately upon Supabase Storage upload.
- **Invariant**: On memory-constrained container environments (<= 512MB RAM), image processing concurrency must remain tightly bounded (<= 2), native buffer caching disabled, and raw image buffers dereferenced immediately upon storage upload. Peak RSS must remain <= 200MB regardless of event size.

---


## 3. Data Preservation Reminders
- The PostgreSQL database hosted on Supabase contains live event and guest schemas.
- `drizzle-kit push --force` or raw `DROP TABLE` is strictly prohibited.
- Preserved asset: `server/assets/ticket_template.png` (289 KB) is the canonical visual template. Do not replace or delete it.


