# Phase 19 Audit & Specification: Context-Aware Host Dashboard Console

## 1. Executive Summary & Objective
Phase 19 consolidates the event operating system into an adaptive, high-performance **Context-Aware Host Dashboard Console**. Up to Phase 18, individual capabilities (verification, lifecycle, RBAC, teams, rubrics, credentials, templates, check-in scanning, jobs, storage, audit logs) were developed as standalone modular cards, resulting in a cluttered vertical stack on `EventDetailPage.tsx`.

Phase 19 delivers:
1. **Context-Aware Adaptive UX**: Dynamically filters modules, telemetry, and quick-actions based on the event's `eventType` (Hackathons vs. Conferences vs. Concerts vs. Workshops vs. Meetups). Irrelevant tools (e.g. hackathon team evaluation during a music concert) are hidden to eliminate organizer cognitive overload.
2. **Unified Aggregated Dashboard Telemetry API**: `GET /api/events/:eventId/dashboard-summary` providing single-request telemetry for credentials, turnstile check-ins, staff counts, team cohorts, storage quota, and recent audit activity.
3. **Modular Console Interface**: Tabbed workspace (Overview & Lifecycle, Credentials & Badges, Staff & Roster, Competition & Tracks, Gate Ops, Security & Audit) styled in the Obsidian/Emerald design system.
4. **Zero-Trust Access Control**: Summary metrics and dashboard console strictly restricted to verified Hosts and Coordinators with event-scoped IDOR protection.

---

## 2. Event-Type Adaptation Matrix

| Event Type | Overview | Credentials | Staff | Competition | Gate Ops | Security |
|---|---|---|---|---|---|---|
| **HACKATHON / COMPETITION** | Enabled | Enabled | Enabled | **Primary (Teams, Mentors, Rubrics)** | Enabled | Enabled |
| **CONFERENCE / SUMMIT** | Enabled | Enabled | Enabled | Hidden | Enabled | Enabled |
| **CONCERT / FESTIVAL** | Enabled | **Primary (VIP, Crew, Tiers)** | Enabled | Hidden | **High-Throughput** | Enabled |
| **WORKSHOP / BOOTCAMP** | Enabled | Enabled | Enabled | Hidden | Attendance Log | Enabled |
| **COLLEGE_FEST** | Enabled | Enabled | Enabled | **Optional Tracks** | Enabled | Enabled |
| **MEETUP / WEBINAR** | Enabled | Simplified | Basic | Hidden | Simplified | Enabled |

---

## 3. Engineering Boundaries & Layered Architecture
- **Route**: `GET /api/events/:eventId/dashboard-summary` mounted in `event.routes.ts`.
- **Controller**: `server/src/modules/events/controllers/event-dashboard.controller.ts`.
- **Service**: `server/src/modules/events/services/event-dashboard.service.ts`.
- **Client API**: `eventsApi.getEventDashboardSummary` in `client/src/api/events.ts`.
- **Frontend Console**: `client/src/components/events/ContextAwareHostConsole.tsx` replacing the monolithic card stack in `client/src/pages/EventDetailPage.tsx`.
