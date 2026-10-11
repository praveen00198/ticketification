# Credential Engine Specification — Ticketification

## 1. Overview & Conceptual Abstraction
The credential engine generates cryptographically verified visual passes and credentials for event attendees and staff. Internally, all passes are modeled as **Event Credentials**, dynamically labeled according to event type (`Ticket`, `Participant Pass`, `Attendee Pass`, `Badge`).

---

## 2. Credential Generation Pipeline
```
Attendee / Guest Metadata
  │
  ├─► 1. Cryptographic Token Generation (crypto.randomBytes(32).toString('hex'))
  ├─► 2. Generate QR Code Buffer (URL: https://APP_DOMAIN/verify/<TOKEN>)
  ├─► 3. Compose SVG Overlay (Template variables + QR + Base64 Devanagari Fonts)
  ├─► 4. Native Sharp Rasterization (.composite() on pre-loaded template PNG)
  ├─► 5. Binary Verification: Assert 8-byte PNG signature (0x89504E47)
  ├─► 6. Upload directly to Supabase Storage: events/{eventId}/credentials/{id}.png
  └─► 7. Commit metadata record to MongoDB credentials collection
```

---

## 3. Opaque Verification Token & QR Specifications
- **Token**: 64-character hexadecimal string generated via `crypto.randomBytes(32).toString('hex')`.
- **Entropy**: Cryptographically secure, non-guessable, unique across the platform.
- **QR Code Content**:
  ```text
  https://ticketification.app/verify/<64-char-hex-token>
  ```
- **Zero PII Leakage**: The QR code encodes **ZERO** personal data (no names, phones, emails, or internal database IDs).

---

## 4. Native Sharp Rasterization (Container-Resilient)
In accordance with ADR-007, ADR-008, and ADR-009:
- **No Headless Chrome / Puppeteer**: Completely eliminated to avoid 200MB+ memory spikes and missing Linux `.so` library crashes in container environments (Render).
- **Native Sharp**: High-performance C++ `libvips` bindings generating 1620x2025 genuine PNGs in ~15ms per pass.
- **Render 512MB RAM Configuration**:
  - `sharp.cache(false)`: Disables native memory buffer caching.
  - `sharp.concurrency(1)`: Limits libvips thread pool.
  - Batch size: 1–2 tickets per batch with immediate buffer dereferencing upon upload.
- **Bundled Fonts**: Google `NotoSansDevanagari-Bold.ttf` embedded as base64 inside SVG markup for deterministic Hindi text shaping.

---

## 5. Image & Format Specifications
| Property | Value |
|---|---|
| **Dimensions** | 1620 × 2025 px |
| **Format** | Genuine PNG Binary (`0x89504E47`) |
| **Renderer** | Native `sharp` with SVG overlay composition |
| **Fallback** | **Zero silent fallbacks** (SVG output strictly prohibited) |
| **QR Dimensions** | 380 × 380 px |
| **QR Error Correction**| Level H (High 30% recovery) |
| **Storage Path** | `/events/{eventId}/credentials/{credentialId}.png` |

---

## 6. Asynchronous Background Jobs for Bulk Generation
Bulk credential generation for 50+ attendees MUST execute via an asynchronous worker queue:
1. API returns `202 Accepted` with `jobId`.
2. Worker processes generation in bounded chunks.
3. Live progress updates recorded in MongoDB (`jobs`).
4. On completion, generates a presigned download URL for the resulting asset package.
