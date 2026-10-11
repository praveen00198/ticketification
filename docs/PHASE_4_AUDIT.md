# PHASE 4 AUDIT: Event Creation Engine & Wizard Implementation

**Date:** 2026-10-09  
**Phase:** Phase 4 — Event Creation Engine  
**Execution Context:** Modular Monolith (Node.js/Express + React/TypeScript)  
**Application Database:** MongoDB (Canonical target) + PostgreSQL/Drizzle (Legacy coexistence)  
**Auth & Storage:** Supabase Auth & Supabase Storage  

---

## 1. Executive Summary & Audit Purpose

Phase 3 established the global user identity extension (`UserModel.hostProfile`), organizer onboarding lifecycle (`POST /api/host/onboarding`), workspace initialization (`workspaceStatus: 'ACTIVE'`), and brand asset management in Supabase Storage (`hosts/{userId}/assets/`).

Phase 4 requires implementing the **Event Creation Engine**:
1. Guided, event-aware creation wizard (Event Type ➔ Basics ➔ Credential Terminology ➔ Attendance/Data Mode ➔ Venue ➔ Schedule ➔ Review & Save).
2. Authoritative MongoDB Event document schema adhering to `docs/database-schema.md`.
3. Strict organizer onboarding prerequisite verification on the backend before event creation.
4. Zero-trust owner derivation from verified Supabase JWTs (`ownerId = mongoUser._id`).
5. Preservation of least-privilege platform role (`platformRole = USER`).
6. Paginated, scoped event retrieval (`GET /api/events`) and draft mutation (`PUT /api/events/:eventId`).
7. Responsive, light-themed frontend with minimal borders, standard Tailwind radii (`rounded`, `rounded-md`, `rounded-full`), and emerald accents.

---

## 2. Verification of Phase 3 Prerequisites

| Prerequisite | Implementation Evidence | Verification Status |
|---|---|---|
| 1. Authenticated user maps to MongoDB User | `mongoUserRepository.findBySupabaseId(supabaseUserId)` in `server/src/modules/auth/repositories/mongo-user.repository.ts` | **VERIFIED** |
| 2. Organizer profile associated with global user | Embedded `hostProfile` in `server/src/db/mongo/models/user.model.ts` | **VERIFIED** |
| 3. Onboarding completion determined consistently | Checks `user.hostProfile?.organizationName` and `user.workspaceStatus === 'ACTIVE'` | **VERIFIED** |
| 4. Workspace status represented correctly | `workspaceStatus: 'ACTIVE' \| 'SUSPENDED'` in `user.model.ts` | **VERIFIED** |
| 5. Verification status distinct from workspace | `hostVerificationStatus: 'UNVERIFIED' \| 'LOW' \| 'MEDIUM' \| 'HIGH'` in `user.model.ts` | **VERIFIED** |
| 6. Frontend can retrieve onboarding state | `GET /api/host/profile` returns `{ isOnboarded, hostProfile, workspaceStatus, verificationStatus }` | **VERIFIED** |
| 7. Backend routes verify Supabase Auth | `authMiddleware` validates JWT, checks expiration, attaches trusted `req.user` | **VERIFIED** |
| 8. Client cannot override organizer identity | All host/event mutations derive caller from `req.user.id`; client-provided `ownerId` / `userId` is ignored | **VERIFIED** |
| 9. Platform role separate from organizer status | Completing onboarding retains `platformRole = 'USER'`; platform admin routes remain 403-protected | **VERIFIED** |
| 10. Build commands clean | Both `client` (`tsc && vite build`) and `server` (`tsc`) compile with 0 errors | **VERIFIED** |

---

## 3. Inventory & Component Classification (`KEEP`, `MODIFY`, `REPLACE`, `REMOVE`)

| Component | Path | Current State | Classification | Action in Phase 4 |
|---|---|---|---|---|
| MongoDB User Model | `server/src/db/mongo/models/user.model.ts` | Complete with `hostProfile` & `workspaceStatus` | **KEEP** | Reference `_id` and `supabaseUserId` for event ownership |
| MongoDB Event Model | `server/src/db/mongo/models/event.model.ts` | Non-existent | **CREATE** | Implement canonical `EventModel` matching `docs/database-schema.md` |
| Mongo Event Repository | `server/src/modules/events/repositories/mongo-event.repository.ts` | Non-existent | **CREATE** | Implement repository layer for MongoDB event documents |
| PostgreSQL Event Schema | `server/src/db/schema/events.ts` | Legacy flat table used by ticket tests | **KEEP** | Preserve for legacy ticket/check-in compatibility |
| Legacy Event Repository | `server/src/modules/events/repositories/event.repository.ts` | Drizzle PostgreSQL operations | **KEEP** | Preserve for existing ticket generation tests |
| Event Types & DTOs | `server/src/modules/events/event.types.ts` | Legacy flat DTOs (`name`, `date`, `venue`) | **MODIFY** | Add canonical wizard types (`EventType`, `AttendanceMode`, `VenueType`, `EventSchedule`, `EventVenue`, `CreateEventWizardDTO`, `UpdateEventDraftDTO`, `EventResponseDTO`) |
| Event Validation | `server/src/modules/events/event.validation.ts` | Validates flat inputs | **MODIFY** | Add `validateEventWizardInput`, `validateEventDraftUpdate`, URL & timezone validation, maintaining legacy helpers |
| Event Service | `server/src/modules/events/services/event.service.ts` | Operates on Drizzle PostgreSQL | **MODIFY** | Upgrade to orchestrate `MongoEventRepository`, check organizer onboarding, enforce draft lifecycle & ownership |
| Event Controller | `server/src/modules/events/controllers/event.controller.ts` | Handlers for `/api/events` | **MODIFY** | Bind wizard inputs, call upgraded service, enforce typed responses and error handling |
| Event Routes | `server/src/modules/events/routes/event.routes.ts` | Mounted at `/api/events` | **MODIFY** | Mount `/`, `/:eventId`, and asset upload endpoints |
| Supabase Storage Service | `server/src/modules/tickets/services/supabase-storage.service.ts` | Host asset upload functions | **MODIFY** | Add `uploadEventBanner` (< 5MB, PNG/JPEG/WEBP) under `events/{eventId}/banners/` or `events/drafts/{userId}/` |
| Client Events API | `client/src/api/events.ts` | Minimal flat API calls | **MODIFY** | Extend with wizard DTOs, pagination params, banner upload, and draft update |
| Event Wizard Component | `client/src/components/events/EventWizard.tsx` | Non-existent | **CREATE** | 7-step accessible, event-type-aware creation wizard |
| Event Type Selector | `client/src/components/events/steps/EventTypeStep.tsx` | Non-existent | **CREATE** | Bento-inspired visual grid for 13 event types with descriptions & icons |
| Event Basics Step | `client/src/components/events/steps/EventBasicsStep.tsx` | Non-existent | **CREATE** | Name, description, banner upload with instant preview |
| Credential Terminology Step | `client/src/components/events/steps/CredentialTerminologyStep.tsx` | Non-existent | **CREATE** | Type-specific suggested defaults with custom override |
| Attendance Mode Step | `client/src/components/events/steps/AttendanceModeStep.tsx` | Non-existent | **CREATE** | Mode A (`TICKETIFICATION_REGISTRATION`) vs Mode B (`EXISTING_ATTENDEE_DATA`) |
| Venue Step | `client/src/components/events/steps/VenueStep.tsx` | Non-existent | **CREATE** | Physical, Online, and Hybrid venue configurations with conditional fields |
| Schedule Step | `client/src/components/events/steps/ScheduleStep.tsx` | Non-existent | **CREATE** | Start/end timestamps, IANA timezone selection, and duration calculator |
| Review & Save Step | `client/src/components/events/steps/ReviewStep.tsx` | Non-existent | **CREATE** | Comprehensive summary, draft confirmation, and submission trigger |
| Events Page | `client/src/pages/EventsPage.tsx` | Legacy modal dialog | **MODIFY** | Integrate Event Creation Wizard, draft status badges, event type tags, and pagination |
| Event Detail Page | `client/src/pages/EventDetailPage.tsx` | Basic display | **MODIFY** | Display full event configuration, schedule in local timezone, venue details, and draft edit mode |
| Navigation Header | `client/src/components/layout/Header.tsx` | Host setup CTA | **MODIFY** | Context-aware "Create Event" CTA linking directly to wizard |

---

## 4. Canonical Event Schema Design

```typescript
// server/src/db/mongo/models/event.model.ts
export type EventType =
  | 'CONFERENCE'
  | 'HACKATHON'
  | 'CONCERT'
  | 'FESTIVAL'
  | 'WORKSHOP'
  | 'COLLEGE_EVENT'
  | 'SPORTS_EVENT'
  | 'EXHIBITION'
  | 'AWARD_CEREMONY'
  | 'CORPORATE_EVENT'
  | 'CULTURAL_EVENT'
  | 'WEDDING'
  | 'OTHER';

export type AttendanceMode =
  | 'TICKETIFICATION_REGISTRATION'
  | 'EXISTING_ATTENDEE_DATA';

export type VenueType = 'PHYSICAL' | 'ONLINE' | 'HYBRID';

export type EventStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'EVENT_LIVE'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface IEventVenue {
  type: VenueType;
  name?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  onlineDescription?: string;
}

export interface IEventSchedule {
  startAt: Date;
  endAt: Date;
  timezone: string; // IANA e.g. "Asia/Kolkata", "UTC"
}

export interface IEventRegistration {
  pricingModel: 'FREE' | 'PAID';
  registrationRequired: boolean;
  capacity?: number;
}

export interface IEvent {
  ownerId: mongoose.Types.ObjectId; // References users._id
  ownerSupabaseId: string;          // Denormalized for rapid zero-trust lookup
  eventType: EventType;
  name: string;
  description?: string;
  bannerUrl?: string;
  credentialTerminology: string;     // e.g. "Ticket", "Participant Pass"
  attendanceMode: AttendanceMode;
  venue: IEventVenue;
  schedule: IEventSchedule;
  registration?: IEventRegistration;
  status: EventStatus;               // Defaults strictly to 'DRAFT'
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexed Query Patterns
1. `{ ownerId: 1, createdAt: -1 }` — Fetch owner's event list sorted newest first.
2. `{ ownerSupabaseId: 1, createdAt: -1 }` — Fast zero-trust lookup by JWT user ID.
3. `{ ownerId: 1, status: 1 }` — Filter owner events by lifecycle status.
4. `{ ownerId: 1, eventType: 1 }` — Filter owner events by type.

---

## 5. Security & Authorization Gates

1. **Onboarding Gate**:
   - `POST /api/events` queries `mongoUserRepository.findBySupabaseId(req.user.id)`.
   - If user record is missing, `hostProfile` is null, or `workspaceStatus !== 'ACTIVE'`, request is rejected with `HTTP 403 Forbidden` (`ONBOARDING_REQUIRED`).
2. **Authoritative Owner Derivation**:
   - `ownerId` and `ownerSupabaseId` are set strictly from the verified authenticated user. Client-supplied IDs are completely ignored.
3. **Draft Status Lockdown**:
   - New events are created with `status = 'DRAFT'`.
   - Updates via `PUT /api/events/:eventId` reject attempts to elevate status to `APPROVED`, `PUBLISHED`, or `EVENT_LIVE`.
4. **Least-Privilege Platform Roles**:
   - Creating or owning events never mutates `platformRole`. The user remains `USER`.
5. **IDOR Prevention**:
   - `GET /api/events/:eventId` and `PUT /api/events/:eventId` strictly verify ownership (`event.ownerSupabaseId === req.user.id`). Unauthorized access returns `404 Not Found` or `403 Forbidden`.

---

## 6. Testing & Regression Strategy

1. **Unit & Integration Suite (`server/tests/eventCreationWizard.test.ts`)**:
   - Event type validation & defaults.
   - Credential terminology defaults and custom overrides.
   - Attendance mode validation (Mode A vs Mode B).
   - Venue validation (physical vs online vs hybrid).
   - Schedule validation (end after start, ISO dates, IANA timezone).
   - Onboarding prerequisite enforcement (un-onboarded host rejected).
   - Draft persistence & status lockdown.
   - Ownership enforcement and IDOR prevention on update & retrieve.
   - Pagination and filtering.
2. **Regression Verification**:
   - `hostOnboarding.test.ts` (Phase 3 organizer onboarding)
   - `mongoIdentity.test.ts` (Phase 2 MongoDB identity)
   - `securityRemediation.test.ts` (Phase 1 zero-trust auth)
   - `auth.test.ts`
   - `events.test.ts` (Legacy event routes)
3. **Build Gates**:
   - `npm run build` in `server/` (0 errors).
   - `npm run build` in `client/` (0 errors).
