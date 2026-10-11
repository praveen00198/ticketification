# Phase 21 Audit & Specification — Interactive Public Platform

## 1. Executive Summary
Phase 21 concludes the platform roadmap, delivering the **Interactive Public Platform**. While Phases 1–19 delivered the organizer operating console and Phase 20 established the attendee self-service wallet and registration, Phase 21 opens Ticketification to public visitors and attendees with public event discovery, rich event microsite landing pages, organizer trust profiles, and trust & safety reporting channels.

---

## 2. Architecture & Invariants

### 2.1 Public Scope & Privacy Boundary
1. **Public Discovery Isolation**: Only events with `status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] }` appear in the public catalog. `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `SUSPENDED`, and `CANCELLED` events are strictly inaccessible to public queries (Zero-Trust IDOR prevention).
2. **PII Sanitization**: Public endpoints sanitize host contact data and internal database tokens. Host profiles only display organization name, institution affiliation, verification tier, bio, and public URLs.
3. **Abuse Reporting Safeguards**: Any public visitor or registered user can report an event. Reports generate persistent records in `event_reports` and immutable entries in `audit_logs` (`EVENT_REPORTED`) for Platform Admin review.

---

## 3. Data Schema: `event_reports`

| Field | Type | Required | Description |
|---|---|---|---|
| `eventId` | ObjectId | Yes | Foreign reference to reported event. |
| `reporterEmail` | String | Yes | Verified email or contact email of reporter. |
| `category` | String | Yes | Enum: `SCAM`, `IMPERSONATION`, `MISLEADING_INFO`, `INAPPROPRIATE_CONTENT`, `OTHER`. |
| `reason` | String | Yes | Specific description of the violation. |
| `status` | String | Yes | Enum: `PENDING`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`. Default `PENDING`. |
| `actionTaken` | String | No | Notes on action taken by platform admin. |
| `createdAt` | Date | Yes | Timestamp of report creation. |

---

## 4. REST API Endpoints

### 4.1 Public Event Discovery & Details
- `GET /api/public/events`: Paginated, filterable event catalog (filters: `eventType`, `search`, `city`, `pricingModel`, `venueType`).
- `GET /api/public/events/:eventId`: Standalone public event details including venue, schedule, pricing model, remaining capacity, and host trust badge.

### 4.2 Public Organizer Profiles
- `GET /api/public/hosts/:hostId`: Public host profile, institution verification status, and active public events.

### 4.3 Trust & Safety Reporting
- `POST /api/public/events/:eventId/report`: Submit an abuse or scam report against an event.

---

## 5. UI/UX Specifications
- **Public Event Catalog (`/explore` or `/events/public`)**:
  - Hero search banner with category filter pills (`Hackathon`, `Conference`, `Concert`, `Workshop`, `Fest`).
  - Search input with debounce by event title, description, or city.
  - Obsidian/Emerald card grid displaying high-contrast event cards, cover banner, date/venue, status pill, and "Claim Pass" / "View Event" buttons.
- **Public Event Landing Microsite (`/events/:eventId/public`)**:
  - Full-width hero banner, countdown clock to event start, verified institutional trust badge.
  - Contextual details: Venue map/online meeting directions, schedule agenda, registration capacity gauge.
  - Quick CTA to open `EventRegistrationModal` and claim an official credential pass.
  - "Report Event" button in footer triggering `ReportEventModal`.
- **Public Event Report Modal (`ReportEventModal.tsx`)**:
  - Clean dialog capturing reporter email, violation category, and description.
