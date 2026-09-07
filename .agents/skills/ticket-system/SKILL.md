---
name: ticket-system
description: Domain business rules, ticket generation pipeline, PNG rendering, storage paths, and check-in workflows.
---

# Ticket System Skill — Ticketification

## Purpose
Authoritative domain logic, generation pipelines, asset rendering rules, filename formats, and verification rules for the ticket lifecycle.

## When to Use
- Implementing or modifying ticket generation, rendering, storage, downloads, scanning, or verification.

## 1. Domain Entities & Categories
- **VIP**: `SINGLE_USE` policy. First scan checks in automatically. Second scan fails (`ALREADY_USED`).
- **Guest**: `SINGLE_USE` policy. First scan checks in automatically. Second scan fails (`ALREADY_USED`).
- **Worker**: `REUSABLE` policy. May be initially unassigned (guestId = null). On first scan, prompt for worker name, record name, and atomically check in. Subsequent scans remain valid (`VALID_WORKER`).

## 2. Generation & PNG Rendering Pipeline
```
Guest List / Request
   │
   ▼
TicketService (Orchestrator)
   │
   ├─► Generate 64-char crypto token
   ├─► Generate QR code (Token URL)
   ├─► TicketRenderingService (Puppeteer)
   │     └─► Renders provided visual template with QR + Guest Name
   │     └─► Produces genuine PNG buffer (verified with isPngBuffer)
   │
   ├─► StorageService
   │     └─► Uploads PNG to Supabase Storage: events/{eventId}/tickets/{filename}.png
   │
   └─► TicketRepository
         └─► Persists ticket record (token, sequenceNumber, assetPath, assetUrl, status)
```

## 3. Strict Rules & Constraints
1. **PNG Binary Only**:
   - Ticket files stored in Supabase Storage and exported in ZIPs MUST be valid PNG binaries (`0x89504E47`).
   - NEVER save SVG files or rename SVG extensions to `.png`.
2. **Visual Template Preservation**:
   - The provided template (`assets/ticket_template.png`) must be visually preserved.
   - Internal Ticket ID (e.g. `GAN-00001`) must NOT be printed visibly on the ticket image. Only Guest Name and QR Code are overlaid.
3. **Canonical Filename Specification**:
   - Pattern: `<Guest-Name>-<Ticket-ID>.png` (e.g. `Rahul-Sharma-GAN-00001.png`).
   - For unassigned worker tickets: `<Ticket-ID>.png` (e.g. `GAN-00001.png`).
   - NEVER output `undefined.png`, `null.png`, or leading/trailing hyphens.
4. **No Regeneration on Download**:
   - Individual download and bulk ZIP export MUST stream existing PNG objects directly from Supabase Storage.
   - Zero on-demand ticket regeneration during download.
5. **Atomic Check-in**:
   - Server-side conditional database update guarantees single-use tickets can never be double checked in.

## Verification Checklist
- [ ] Stored ticket asset is genuine binary PNG.
- [ ] No Ticket ID visibly printed on the ticket image.
- [ ] Filename conforms to `<Guest-Name>-<Ticket-ID>.png`.
- [ ] Verification enforced server-side.
