# Phase 13 Implementation Audit: Credential Templates & Sharp Rendering Engine

## 1. Executive Summary & Purpose
Ticketification supports diverse event types (Conferences, Hackathons, Concerts, Festivals, Workshops, Competitions). Each event archetype requires a distinct visual pass layout (e.g., Portrait Conference Badges with prominent speaker titles, Landscape Concert Tickets with seat/tier indicators, Hackathon Participant Badges with team & track badges, and Worker/Staff passes).

**Phase 13: Credential Templates** introduces:
1. **Dynamic Credential Template Model** (`event_credential_templates` collection in MongoDB):
   - Stores visual dimensions, background asset storage pathways in Supabase Storage, active default designations, and dynamic field binding definitions.
2. **Dynamic Field Binding Specification**:
   - `{{name}}`: Attendee / Holder Full Name
   - `{{qr}}`: Opaque 64-character verification URL QR Code (`https://APP_DOMAIN/verify/<TOKEN>`)
   - `{{sequence}}`: Formatted sequence tag (e.g. `TIC-00001`, `BDG-00042`, `WRK-00010`)
   - `{{role}}`: Role category badge (e.g. `PARTICIPANT`, `VIP`, `SPEAKER`, `ORGANIZER`, `WORKER`)
   - `{{eventName}}`: Event display title
   - `{{date}}`: Formatted schedule date
   - `{{venue}}`: Physical or virtual venue name
3. **Container-Resilient Sharp Rasterization Engine**:
   - Native C++ `libvips` bindings via `sharp` compositing SVG overlays with embedded QR codes and fonts.
   - Strictly conforms to Render 512MB RAM constraints (`sharp.cache(false)`, `sharp.concurrency(1)`).
   - Zero Puppeteer/headless browser runtime dependencies in production image rendering.
   - Rigorous binary assertion: Every generated asset is verified as genuine PNG (`0x89504E47`).
4. **Pre-configured Global Presets**:
   - `CONFERENCE_BADGE`: High-visibility portrait badge with centered name, role, and QR code.
   - `CONCERT_TICKET`: Standard admission ticket with event branding and access code.
   - `HACKATHON_PASS`: Hacker pass displaying hacker name, track/team metadata, and fast scanner QR.
   - `WORKER_PASS`: Reusable staff credential with bold sequence ID and high-contrast styling.
5. **Real-time Live Preview & Render Pipeline**:
   - Generates simulated preview assets with mock attendee data.
   - On-demand asset generation that uploads rendered PNGs directly to Supabase Storage at `events/${eventId}/credentials/${credentialId}.png` and commits asset metadata to MongoDB `event_credentials`.

---

## 2. Security Boundaries & Architectural Invariants
1. **Zero PII Exposure on QR Codes**:
   - The QR code embedded on the credential template contains exclusively the opaque 64-character verification token URL. Never personal attendee emails, phone numbers, or private MongoDB ObjectIds.
2. **Host/Coordinator RBAC Authorization**:
   - Only `HOST` and `COORDINATOR` members (verified via MongoDB `event_members`) are authorized to create, update, delete, or activate templates for an event.
3. **Cross-Event Isolation (IDOR Prevention)**:
   - All queries and mutations verify `{ eventId, _id }`. System global presets are read-only and immutable.
4. **Storage & Binary Invariants**:
   - All uploaded and generated assets must be genuine PNG binaries (`0x89504E47`). SVG output or renamed file extensions are strictly prohibited.
5. **Memory Concurrency Cap**:
   - In accordance with ADR-007, ADR-008, and ADR-009, Sharp memory caching is disabled to prevent RSS memory leaks in 512MB RAM environments.

---

## 3. Data Collection Schema (`event_credential_templates`)

- `_id`: ObjectId
- `eventId`: ObjectId | null (null for platform-wide global presets, required for event-scoped custom templates)
- `name`: string (e.g. "Default Conference Badge", "VIP Gold Pass")
- `description`: string | null
- `isDefault`: boolean (default: false; exactly one default per event)
- `presetId`: `'CONFERENCE_BADGE' | 'CONCERT_TICKET' | 'HACKATHON_PASS' | 'WORKER_PASS' | 'CUSTOM'`
- `dimensions`:
  - `width`: number (default: 1620)
  - `height`: number (default: 2025)
- `backgroundStoragePath`: string | null (path in Supabase Storage)
- `backgroundPublicUrl`: string | null (URL for template background preview)
- `fields`: Array of:
  - `key`: `'name' | 'qr' | 'sequence' | 'role' | 'eventName' | 'date' | 'venue' | 'custom'`
  - `label`: string
  - `x`: number (px X-coordinate)
  - `y`: number (px Y-coordinate)
  - `width`: number | null (e.g. 380 for QR)
  - `height`: number | null (e.g. 380 for QR)
  - `fontSize`: number | null (e.g. 64)
  - `fontFamily`: string (default: `'Noto Sans, sans-serif'`)
  - `fontWeight`: string (default: `'bold'`)
  - `color`: string (hex code e.g. `'#FFFFFF'`, `'#10B981'`)
  - `textAlign`: `'left' | 'center' | 'right'` (default: `'center'`)
  - `visible`: boolean (default: true)
- `createdBy`: ObjectId | null
- `createdAt`: Date
- `updatedAt`: Date

Indexes:
- `{ eventId: 1, isDefault: 1 }`
- `{ eventId: 1 }`

---

## 4. API Endpoints
- `GET /api/events/:eventId/credential-templates` — List available templates & global presets for an event.
- `POST /api/events/:eventId/credential-templates` — Create a custom template or clone a preset.
- `GET /api/events/:eventId/credential-templates/:templateId` — Get template details by ID.
- `PUT /api/events/:eventId/credential-templates/:templateId` — Update template dimensions and field coordinates.
- `PUT /api/events/:eventId/credential-templates/:templateId/set-default` — Mark template as active default for event.
- `DELETE /api/events/:eventId/credential-templates/:templateId` — Delete custom template.
- `POST /api/events/:eventId/credential-templates/preview` — Generate simulated rendered preview PNG with mock data.
- `POST /api/events/:eventId/credentials/:credentialId/render` — Render genuine PNG asset and upload to Supabase Storage.

---

## 5. Verification Matrix
- Automated test suite `server/tests/credentialTemplateEngine.test.ts` testing:
  - Global preset seeding and lookup.
  - Template CRUD and default activation.
  - Dynamic field binding replacement (`{{name}}`, `{{qr}}`, `{{sequence}}`, etc.).
  - Sharp rasterization producing verified PNG buffer (`0x89504E47`).
  - Memory bounds validation (`sharp.cache(false)`).
  - RBAC authorization and cross-event isolation.
  - Full client & server type check and production builds (`npm run build`).
