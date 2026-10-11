# PHASE_16_AUDIT.md — Phase 16: Export Jobs Architectural Specification

## 1. Domain Context & Objective
Organizers need to export event data in bulk:
1. **Visual Credential Passes (.zip)**: All rendered PNG passes named cleanly (e.g., `PASS-00001-Rahul-Sharma.png`) for local badge printing, lanyard packaging, or archival backup.
2. **Attendee Check-in & Roster Reports (.xlsx / .csv)**: Granular roster with holder information, formatted sequence IDs, verification tokens, check-in timestamps, gates, and scanner details.

## 2. Engineering Invariants & Constraints
1. **Never Buffer Huge Archives in RAM**: Multi-gigabyte archives must not buffer in Node.js heap memory, adhering to Render 512MB RAM bounds.
2. **Asynchronous HTTP 202 Accepted**: Any export operation queries credentials in batches and streams to background execution. The HTTP endpoint returns `202 Accepted` with `jobId`.
3. **Presigned Object Storage URLs**: The generated archive or spreadsheet is uploaded directly to Supabase Storage under `events/${eventId}/exports/`. The API generates a 24-hour presigned download URL; the client downloads directly from Supabase Storage CDN without proxying through Node.
4. **Zero-Trust Staff RBAC**: Only Hosts and Coordinators evaluated via MongoDB `event_members` can enqueue exports and receive download links.
5. **Real-Time Progress Tracking**: Real-time progress percentage and item counters (`processed` / `total`) via `event_jobs`.

## 3. Schema & Model Extensions
- `JobType`: Extended with `'EXPORT_CREDENTIALS'`.
- `IJobResult`: Extended with `exportedCount`, `downloadUrl`, `storagePath`, and `fileSizeBytes`.

## 4. Layered Architecture Implementation
- `event-export.service.ts`: Handles streaming ZIP archive generation via `archiver` and spreadsheet compilation via `xlsx`, uploads to Supabase Storage, and issues signed download URLs.
- `event-job-queue.service.ts`: Enqueues export jobs, executes async processing, updates progress, and isolates failure handling.
- `event-job.controller.ts`: Exposes `POST /:eventId/jobs/export`.
- `EventExportModal.tsx`: Modern Obsidian/Emerald UI for one-click exports and instant presigned download.
