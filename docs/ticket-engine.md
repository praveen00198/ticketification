# Ticket Engine Specification

## Overview
The ticket engine generates cryptographically verified QR ticket images for event guests. Each ticket contains an opaque verification token — no personal information is encoded in the QR.

## Ticket Generation Flow
```
Guest Record
  → Generate Verification Token (crypto.randomBytes(32).toString('hex'))
  → Generate QR Code (URL: https://APP_DOMAIN/verify/<TOKEN>)
  → Build HTML/CSS Ticket (template + dynamic data overlay)
  → Render via Puppeteer → PNG (1620×2025px)
  → Upload to Supabase Storage (tickets/<event-id>/<ticket-uuid>.png)
  → Store asset_path + asset_url in tickets table
```

## Verification Token
- Generated using `crypto.randomBytes(32).toString('hex')` — 64-character hex string
- Cryptographically secure, non-guessable
- Unique across entire database (UNIQUE constraint + index)
- Never reused, never recycled

## QR Code Content
```
https://APP_DOMAIN/verify/<64-char-hex-token>
```

Never contains: name, phone, email, event data, database IDs.

## Ticket Types & Usage Policy
| Category | Usage Policy | Check-in Behavior |
|---|---|---|
| VIP | SINGLE_USE | One check-in → status becomes USED |
| GUEST | SINGLE_USE | One check-in → status becomes USED |
| WORKER | REUSABLE | Multiple check-ins → each recorded, status stays ACTIVE |

New types (SPEAKER, MEDIA, VOLUNTEER) can be added via `ticket_types` table without code changes.

## Unassigned Worker Tickets
- Created with `guest_id = NULL`
- Ticket image shows "UNASSIGNED" in place of guest name
- On first scan, scanner prompts for name → creates/updates guest record → links to ticket
- Subsequent scans show the assigned name

## Ticket Regeneration
- Regenerates the visual image only
- **Same verification token is preserved** — no duplicate credentials created
- Use case: template change, branding update, or asset re-rendering

## Sequence Numbers
Each ticket gets an event-scoped `sequence_number` for deterministic ordering.
- Query: `SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM tickets WHERE event_id = $1`
- Unique constraint: `(event_id, sequence_number)`

## Bulk Generation
- For 1,400+ tickets, generation should not block a single HTTP request indefinitely
- MVP approach: process in manageable batches with progress tracking
- No heavyweight job queues (Kafka/BullMQ) needed at this scale

## Image Specifications
| Property | Value |
|---|---|
| Dimensions | 1620 × 2025 px |
| Format | PNG |
| Renderer | Puppeteer (headless Chrome) |
| Fallback | SVG |
| QR Size | 380 × 380 px |
| QR Error Correction | High (H) |
