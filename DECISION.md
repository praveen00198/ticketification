# DECISION.md — Architecture Decision Records (ADRs)

## ADR-001: Modular Monolith over Microservices
- **Status**: ACCEPTED
- **Context**: Ticketification operates on cost-effective infrastructure (such as Render and Supabase) with target concurrency scaling up to 10,000–20,000 attendees. Introducing microservices would cause operational friction, network overhead, and complex distributed transaction management.
- **Decision**: Structure the backend as a **Modular Monolith** with strict domain module boundaries (`auth`, `users`, `events`, `members`, `teams`, `evaluation`, `credentials`, `checkin`, `jobs`, `audit`).
- **Consequences**: Fast local development, unified CI/CD deployment, zero distributed network latency, clear internal boundaries ready for future service extraction only if justifiable.

---

## ADR-002: One Global User Identity
- **Status**: ACCEPTED
- **Context**: An individual user can participate in multiple events in completely different capacities (e.g. Host of Event A, Judge/Evaluator of Event B, Volunteer of Event C, Attendee of Event D). Creating separate tables for `hosts`, `attendees`, and `volunteers` causes fragmented identities and password fatigue.
- **Decision**: Maintain a single global user account for every person. Roles are **event-scoped relationships** defined in an `event_members` collection rather than fixed global identities.
- **Consequences**: Users log in once and switch contexts between their events. Roles and permissions are evaluated dynamically based on the active event context.

---

## ADR-003: Supabase Auth for Authentication
- **Status**: ACCEPTED
- **Context**: Custom password hashing and session management introduce security risks and maintenance overhead.
- **Decision**: Use Supabase Auth exclusively as the identity and authentication provider. Supabase Auth manages email/password, social logins, password resets, and JWT issuance.
- **Consequences**: The backend server validates Supabase JWTs without managing raw password hashes. Service role keys remain strictly server-side.

---

## ADR-004: MongoDB for Application Authorization and Business Entities
- **Status**: ACCEPTED
- **Context**: Ticketification supports diverse event types (Hackathons with teams, rubrics, and judging matrices; Conferences with multi-track attendees; Bootcamps with dynamic custom registration fields). Enforcing static relational tables across all event types creates schema rigidity.
- **Decision**: Adopt **MongoDB** as the target application database for application profiles, event lifecycles, event memberships, RBAC permissions, teams, evaluation rubrics, credential metadata, and audit logs.
- **Consequences**: Highly flexible document schemas tailored to event types; dynamic registration form schemas; high-volume document ingestion during check-in and import jobs.

---

## ADR-005: Supabase Storage for Files and Binary Assets
- **Status**: ACCEPTED
- **Context**: Storing large image buffers (1620x2025 PNGs), PDFs, spreadsheets, and ZIP archives directly in MongoDB bloats documents, degrades query performance, and exceeds document size limits (16MB).
- **Decision**: Use **Supabase Storage** for all file binaries under canonical paths (`/events/{eventId}/credentials/`, `/events/{eventId}/exports/`). MongoDB stores only file metadata and storage keys.
- **Consequences**: Clean separation of data and files; presigned direct uploads and downloads bypass Node memory; zero database bloat.

---

## ADR-006: Asynchronous Background Jobs for Heavy Operations
- **Status**: ACCEPTED
- **Context**: Generating 1,000–20,000 credential images, parsing 10MB spreadsheets, and compiling multi-gigabyte ZIP archives inside synchronous HTTP requests causes gateway timeouts (Render 30s limit) and process crashes.
- **Decision**: All operations processing more than 50 records MUST execute asynchronously via a background job queue. The API returns `202 Accepted` with a `jobId` immediately.
- **Consequences**: HTTP requests remain fast (< 200ms); workers process tasks in bounded batches; progress is trackable; failure retries are isolated.

---

## ADR-007: Container-Safe Native Sharp Rasterization over Headless Chromium
- **Status**: ACCEPTED
- **Context**: Headless Chromium (Puppeteer) in containerized cloud environments (e.g. Render Linux containers) requires desktop shared libraries (`libnss3`, `libatk`) and consumes 200MB+ RAM per process, causing out-of-memory crashes on 512MB RAM containers.
- **Decision**: Use native server-side rasterization via `sharp` for converting SVG overlays into authentic PNG binaries (`0x89504E47`).
- **Consequences**: Renders tickets in ~15ms with zero external browser dependencies, 100% container stability, and strictly bounded memory usage.

---

## ADR-008: Render 512MB RAM Optimization: Disabled Cache and Thread Concurrency
- **Status**: ACCEPTED
- **Context**: Sharp defaults to `sharp.cache(true)` and multi-threaded libvips worker pools, which retain native C++ decompressed image buffers outside the V8 heap, causing Linux OOM killer termination on 512MB RAM limits.
- **Decision**: Explicitly configure `sharp.cache(false)` and `sharp.concurrency(1)`, pre-load master background buffers, composite overlays via native bindings, bound batch sizes to 1–2 items, and dereference image buffers immediately after upload.
- **Consequences**: Process RSS remains stably under 200MB even during high-volume batch credential generation.

---

## ADR-009: Bundled Devanagari OpenType Fonts for Deterministic Text Shaping
- **Status**: ACCEPTED
- **Context**: Cloud containers lack Indic fonts in `/usr/share/fonts`, causing corrupted glyphs and disjoined matras when rendering Hindi or Sanskrit text (e.g. `|| श्री गणेशाय नमः ||`).
- **Decision**: Bundle Google `NotoSansDevanagari-Bold.ttf` inside `assets/fonts/` and embed font binaries as base64 within `@font-face` inside SVG templates.
- **Consequences**: Flawless Devanagari text shaping, conjunct resolution, and matra positioning across all operating systems without external font network dependencies.

---

## ADR-010: Opaque 64-Character Verification Tokens without PII
- **Status**: ACCEPTED
- **Context**: Encoding attendee names, emails, or phone numbers in QR codes exposes personal information to anyone who photographs or scans the pass.
- **Decision**: QR codes encode ONLY a 64-character cryptographic token URL (`https://ticketification.app/verify/<TOKEN>`). The backend performs indexed lookup to retrieve details.
- **Consequences**: Zero PII leakage; tamper-proof credentials; revocation and check-in status can be modified on the server without changing the physical pass.

---

## ADR-011: Atomic Conditional Check-In for Concurrency and Double-Scan Prevention
- **Status**: ACCEPTED
- **Context**: In high-density gate entry scenarios, two volunteers may scan the same ticket at the exact same second. Separate lookup and update queries create race conditions.
- **Decision**: Enforce atomic conditional updates (`findOneAndUpdate` matching `{ status: 'ACTIVE' }` and updating to `'CHECKED_IN'`).
- **Consequences**: Exactly one scan succeeds. Simultaneous scans immediately fail with `ALREADY_CHECKED_IN` and return the prior check-in timestamp.

---

## ADR-012: Dynamic Column Header Mapping for Excel Imports
- **Status**: ACCEPTED
- **Context**: Organizers maintain spreadsheets with varying header naming conventions (`Attendee Name`, `Participant`, `Mobile No`, `Phone`).
- **Decision**: Implement a smart import engine that detects column headers dynamically, calculates confidence scores, and allows custom column mapping. Enforce only `Name` and `Category` by default, keeping phone and email optional.
- **Consequences**: Organizers are never forced into rigid spreadsheet formats.

---

## ADR-013: First-Scan Name Assignment for Unassigned Worker Passes
- **Status**: ACCEPTED
- **Context**: Event staff and volunteer passes are often printed in bulk before individual volunteer names are finalized.
- **Decision**: Worker passes can be generated without assigned names. On first scan, the mobile scanner prompts the operator for the worker's name and saves the record atomically during the first check-in.
- **Consequences**: Rapid field badge issuance without requiring pre-event administrative overhead.

---

## ADR-014: Visual Identity in Obsidian and Emerald (Strict Prohibition of Purple)
- **Status**: ACCEPTED
- **Context**: The platform requires a cohesive, professional, high-contrast operational aesthetic.
- **Decision**: Standardize all interfaces around Obsidian dark surfaces (`#09090b`, `#121215`) and Vivid Emerald accents (`#10b981`, `#059669`). Random purple, violet, or indigo styling is strictly prohibited.
- **Consequences**: Immediate visual recognition, high outdoor readability on mobile scanners, and unified design language.

---

## ADR-015: Server-Controlled Platform Role Resolution & Zero-Trust Resource Scoping (Phase 1 Remediation)
- **Status**: IMPLEMENTED
- **Context**: Security audit identified critical privilege escalation where public registration defaulted accounts to `ADMIN`, auth middleware read client-editable metadata `user.user_metadata.role`, and IDOR vulnerabilities allowed cross-organizer access to `GET /api/tickets/:id` and `GET /api/verify/recent/:eventId`.
- **Decision**:
  1. Default platform role is strictly `USER` on registration and profile synchronization.
  2. Public registration ignores client-supplied roles.
  3. Platform authorization middleware (`requireRole`, `requireAdmin`, `requireSuperAdmin`) evaluates server-controlled database records (`users.role`), never client claims or frontend state. Fails closed (401 unauthenticated, 403 unauthorized).
  4. Platform administrator bootstrapping/reconciliation is explicitly gated by server configuration (`INITIAL_ADMIN_EMAILS`).
  5. `GET /api/tickets/:id` enforces event ownership (`event.createdBy === req.user.id`).
  6. `GET /api/verify/recent/:eventId` enforces event ownership (`event.createdBy === req.user.id`).
  7. `GET /api/dashboard/stats` enforces event ownership.
- **Consequences**:
  - Privilege escalation and IDOR flaws are fully remediated.
  - Public credential verification (`GET /verify/:token`, `GET /api/verify/:token`) remains functional and public.
  - Existing working Drizzle/PostgreSQL schema, Sharp rasterization, QR token generation, and atomic check-ins are preserved intact.

---

## ADR-016: Dual-Database Coexistence & MongoDB Application Identity (Phase 2)
- **Status**: IMPLEMENTED
- **Context**: The target architecture specifies MongoDB for flexible event documents, RBAC, and high-throughput operations, while legacy user profiles, events, and tickets are stored in PostgreSQL via Drizzle ORM. Immediate database cutover would break existing operational assets and client workflows.
- **Decision**:
  1. Introduce Mongoose connection management (`server/src/db/mongodb.ts`) with connection pooling (`maxPoolSize: 10`, `minPoolSize: 2`, `serverSelectionTimeoutMS: 5000`) and graceful disconnect handling.
  2. Implement target `UserModel` (`server/src/db/mongo/models/user.model.ts`) strictly matching `docs/database-schema.md`: `_id`, `supabaseUserId` (unique index), `email` (unique index, lowercase), `name`, `phone`, `avatarUrl`, `platformRole` (`'USER' | 'ADMIN' | 'SUPER_ADMIN'`), `status` (`'ACTIVE' | 'SUSPENDED'`), `metadata`, and timestamps.
  3. Enforce layered architecture with `MongoUserRepository` (`server/src/modules/auth/repositories/mongo-user.repository.ts`) with explicit sort ordering (`{ createdAt: -1 }`).
  4. Implement `IdentitySyncService` (`server/src/modules/auth/services/identity-sync.service.ts`) for non-blocking dual-write synchronization during auth operations and batch migration (`syncUsersToMongo.ts`).
  5. Handle offline/standby state gracefully: If MongoDB is unconfigured or unreachable, the application continues operating PostgreSQL flows safely without crashing.
- **Consequences**:
  - Global user identities coexist cleanly across both database engines.
  - Zero regression on existing PostgreSQL operations, tickets, QR codes, and rasterization.
  - Paves the way for Phase 3 (Host Identity + Onboarding) and Phase 7 (Event Membership RBAC).

---

## ADR-017: Host Identity, Organizer Onboarding & Workspace Initialization (Phase 3)
- **Status**: IMPLEMENTED
- **Context**: In Ticketification, an authenticated user (`platformRole: 'USER'`) must be able to configure an organizer profile, upload branding assets, specify institution affiliation, and initialize an active organizer workspace. A naive design would create a separate `hosts` collection or elevate the user's platform role to `ADMIN`, violating core invariants (One Global User Identity, Least Privilege).
- **Decision**:
  1. **Global Identity Extension**: Extend the existing MongoDB `users` collection with embedded `hostProfile` schema, `workspaceStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING'`, and `hostVerificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'`. Never create a separate `hosts` collection or table.
  2. **Strict Least Privilege**: Completing host onboarding NEVER elevates `platformRole`. The user remains `platformRole: 'USER'`. System-level `ADMIN` and `SUPER_ADMIN` privileges remain strictly reserved for platform administrators.
  3. **Zero-Trust JWT Scoping**: Host onboarding, profile updates, and asset uploads derive caller identity strictly from validated Supabase JWTs (`req.user.id`). Client-supplied user IDs in request bodies or query parameters are ignored, completely preventing IDOR.
  4. **Idempotent Workspace Lifecycle**: `POST /api/host/onboarding` behaves idempotently. Repeated submissions safely update the organizer profile and return HTTP 200 without creating duplicate documents or corrupting state.
  5. **Cloud Object Storage for Branding**: Organizer logos are stored in Supabase Storage under canonical isolated paths (`hosts/{userId}/assets/{timestamp}_{filename}`). Binary files are never stored in MongoDB or local filesystem.
  6. **Light-Themed Context-Aware UX**: Deliver a clean, minimal, spacious UI with crisp borders, subtle shadows, and emerald `#10b981` accents. Non-onboarded users are provided with an explicit onboarding banner and button in navigation; onboarded organizers see workspace status indicators and profile settings links.
- **Consequences**:
  - Organizers possess structured organizational identities without fragmenting global user authentication.
  - Platform role isolation is preserved with 100% test coverage against privilege escalation regressions.
  - Clean foundation established for Phase 4 (Event Lifecycle & Wizard Engine) and Phase 7 (Event-Scoped Membership RBAC).

---

## ADR-018: Event Creation Engine, Event-Type-Aware Wizard & Credential Taxonomy (Phase 4)
- **Status**: IMPLEMENTED
- **Context**: Ticketification supports diverse event types (Hackathons, Conferences, Concerts, Festivals, Workshops, Exhibitions, etc.), each requiring domain-relevant terminology (e.g., "Participant Pass", "Attendee Pass", "Ticket", "Entry Pass"), distinct venue configurations (Physical, Online, Hybrid), date/time schedules with explicit IANA timezones, and two distinct attendee ingestion modes (`TICKETIFICATION_REGISTRATION` and `EXISTING_ATTENDEE_DATA`). A naive design would create divergent event schemas or hardcode ticket strings across the codebase.
- **Decision**:
  1. **Canonical Event Model**: Create a single canonical MongoDB `EventModel` (`server/src/db/mongo/models/event.model.ts`) mapped to the `events` collection. Supports 13 canonical `EVENT_TYPES`, `ATTENDANCE_MODES`, `VENUE_TYPES`, structured `venue` (Physical / Online / Hybrid), `schedule` (startAt and endAt stored as UTC with explicit IANA `timezone`), and optional `registration` intent (free vs paid draft preference).
  2. **Authoritative Owner Derivation & Preconditions**:
     - All created events derive `ownerId` (MongoDB ObjectId) and `ownerSupabaseId` (UUID) strictly from the verified authentication context (`req.user.id`).
     - Gated by backend organizer onboarding verification: Callers without an active host profile (`workspaceStatus === 'ACTIVE'`) are rejected with `403 Forbidden` (`ONBOARDING_REQUIRED`), directing them to onboarding.
     - Event creation NEVER elevates `platformRole`. The user remains `platformRole: 'USER'`.
  3. **Credential Terminology Abstraction**: The core engine preserves a universal, generic credential abstraction internally, while storing a configurable `credentialTerminology` display string per event. Sensible defaults are automatically suggested based on the selected event type (e.g. Hackathon -> "Participant Pass", Concert -> "Ticket", Conference -> "Attendee Pass") while permitting host customization.
  4. **Strict Draft Lifecycle Lockdown**: Newly created events are strictly initialized to `status: 'DRAFT'`. Any attempt by client payloads to forge `status` to `APPROVED`, `PUBLISHED`, `ACTIVE`, etc. is rejected with HTTP 400.
  5. **Two Principal Attendance / Data Modes**:
     - `TICKETIFICATION_REGISTRATION`: Sets up intended public registration workflows on Ticketification. Captures draft pricing intent (`FREE` | `PAID`) and capacity without prematurely executing payment processing or gateway verification.
     - `EXISTING_ATTENDEE_DATA`: Prepares the event for external roster uploads (Google Forms, CSV, Excel) without requiring Ticketification public registration forms.
  6. **Asset Storage Separation**: Event banners are uploaded to Supabase Storage under `events/banners/{userId}/{timestamp}_{filename}` with image validation (PNG/JPEG/WEBP, < 5MB). MongoDB stores only the resulting public URL.
  7. **Backward Compatibility**: `EventService` and `EventController` maintain full backward compatibility with legacy PostgreSQL queries and endpoints (`events.test.ts`), ensuring existing check-in, Sharp rasterization, and QR workflows remain unaffected.
  8. **Design System & UX Standards**: Guided 7-step wizard with bento-inspired event type selector cards, live badge header preview, responsive layout, restrained emerald `#10b981` accents, soft neutral backgrounds, and standard Tailwind radii (`rounded`, `rounded-md`, `rounded-full`).
- **Consequences**:
  - Organizers can rapidly draft and configure rich, event-aware experiences across 13 event types.
  - The security boundary is strictly enforced on the server (108 backend tests passing).
  - Prepares the platform cleanly for Phase 5 (Institutional Verification) and Phase 6 (Event Publishing & Risk Scoring Engine).

---

## ADR-019: Event Verification & Risk-Based Review Engine (Phase 5)
- **Status**: IMPLEMENTED
- **Context**: Events hosted on Ticketification require high trust, especially for educational, university, and collegiate events as well as large-scale or ticketed gatherings with financial exposure. A naive architecture would either allow unverified publishing of high-capacity paid events or elevate hosts to administrative roles to bypass gates, violating Least Privilege and Event Isolation.
- **Decision**:
  1. **Canonical `event_verifications` Model**:
     - Introduced `EventVerificationModel` (`server/src/db/mongo/models/event-verification.model.ts`) with unique compound index on `{ eventId: 1 }`.
     - Captures institutional affiliation (`institutionName`, `institutionType`, `officialEmail`, `department`, `designation`, `websiteUrl`), security credentials (`otpHash`, `otpExpiresAt`, `otpVerified`), uploaded evidence (`documentUrls`), and platform review audit fields (`status`, `riskScore`, `riskTier`, `riskFactors`, `reviewedBy`, `reviewNotes`, `submittedAt`, `reviewedAt`).
     - Sensitive OTP fields (`otpHash`, `otpExpiresAt`) are excluded from default queries via `{ select: false }` schema projections.
  2. **Institutional Domain OTP Verification Flow**:
     - Host triggers `POST /api/events/:eventId/verification/send-otp` with their institutional email.
     - Generates cryptographically secure 6-digit numeric OTP (`crypto.randomInt`), stored as salted SHA-256 hash with 10-minute expiry window.
     - Verification endpoint `POST /api/events/:eventId/verification/verify-otp` uses constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
  3. **Verification Document Storage Separation**:
     - Authorization proof documents (letters of recommendation, college department approvals, venue contracts in PDF, PNG, JPEG, WEBP up to 10MB) are uploaded directly to Supabase Storage under `events/{eventId}/verification/{timestamp}_{filename}`.
     - Binary buffers are never stored in MongoDB; only immutable presigned/public URLs are referenced.
  4. **Multi-Factor Risk Scoring Engine**:
     - Built deterministic risk calculation evaluating event registration type (free vs paid), venue capacity, email domain trust (flagging generic webmail providers), and documentation completeness.
     - Categorizes events into `LOW` ($S < 25$), `MEDIUM` ($25 \le S \le 60$), and `HIGH` ($S > 60$) risk tiers, outputting explicit audit risk factor codes.
  5. **Submission Verification Gates**:
     - Free events require verified official email before submission.
     - Paid events and events with capacity > 2,000 strictly require at least one verified authorization document before submission.
     - Submission transitions `Event.status = 'SUBMITTED'` and `verificationStatus = 'PENDING'`.
  6. **Zero-Trust Platform Administrator Review API**:
     - Platform review endpoints (`GET /api/admin/verifications` and `POST /api/admin/verifications/:eventId/review`) are strictly protected by `requireAdmin` middleware.
     - Approval transitions `Event.status = 'APPROVED'` and `verificationStatus = 'VERIFIED'`; rejection transitions `Event.status = 'DRAFT'` and `verificationStatus = 'REJECTED'` with explicit feedback notes.
     - Host platform role is strictly immutable: hosts remain `platformRole: 'USER'`.
  7. **Frontend Institutional Verification Experience**:
     - Built `EventVerificationCard` (`client/src/components/events/EventVerificationCard.tsx`) embedded within event configuration pages.
     - Strictly complies with `.agents/skills/frontend-design` standards (emerald `#10b981` accents, clean neutral surfaces, monospace OTP fields, zero purple/indigo/violet).
- **Consequences**:
  - Educational and organizational legitimacy is strictly verified prior to public publishing.
  - Financial and safety risk is mitigated via automated scoring and mandatory document verification for high-scale events.
  - System invariants (Least Privilege, Event Isolation, Storage Separation) are 100% preserved.

---

## ADR-020: Authoritative Event Lifecycle Engine & Emergency Circuit Breakers (Phase 6)
- **Status**: IMPLEMENTED
- **Context**: Events progress across distinct operational stages (`DRAFT`, `SUBMITTED`, `APPROVED`, `PUBLISHED`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `EVENT_LIVE`, `COMPLETED`, `ARCHIVED`), with critical exception branches (`UNDER_REVIEW`, `REJECTED`, `SUSPENDED`, `CANCELLED`). Without a centralized state machine, status mutations risk bypassing verification gates (e.g. unverified publishing of paid events) or leaving attendees vulnerable to fraud when emergency intervention is required.
- **Decision**:
  1. **Canonical State Transition Graph**:
     - Centralized in `server/src/modules/events/services/event-lifecycle.service.ts` with strict `ALLOWED_TRANSITIONS` mapping.
     - Direct unapproved publishing from `DRAFT` is strictly forbidden.
     - Publishing from `APPROVED` enforces the Phase 5 gate (`verificationStatus === 'VERIFIED'`).
  2. **Immutable Transition Audit Logging (`statusHistory`)**:
     - Extended `EventModel` with `statusHistory: [{ fromStatus, toStatus, changedBy, changedBySupabaseId, reason, timestamp }]`.
     - Every state mutation conditionally appends to `statusHistory` atomically via `transitionStatus`.
  3. **Emergency Circuit Breaker Architecture**:
     - Mounted platform administration endpoints at `/api/admin/events/:eventId/suspend` and `/api/admin/events/:eventId/reinstate` protected by `requireAdmin`.
     - Administrative suspension captures mandatory reason, timestamp, and actor, immediately locking the event (`EVENT_SUSPENDED`).
     - Core verification and attendance operations leverage `assertEventOperational` to block suspended and cancelled events.
  4. **Host Lifecycle Endpoints**:
     - Standardized REST operations under `/api/events/:eventId` (`/publish`, `/registrations/open`, `/registrations/close`, `/live`, `/complete`, `/archive`, `/cancel`, `/lifecycle/transition`, `/lifecycle/history`).
     - IDOR protected via strict ownership check (`event.ownerSupabaseId === callerSupabaseId`).
  5. **Context-Aware Lifecycle UI**:
     - Implemented `EventLifecycleBar` (`client/src/components/events/EventLifecycleBar.tsx`) with an interactive state progression stepper, dynamic status action buttons, cancellation modal, and immutable history viewer.
     - Strictly complies with `.agents/skills/frontend-design` standards (emerald `#10b981` accents, clean neutral surfaces, zero forbidden violet/indigo colors).
- **Consequences**:
  - Event lifecycle transitions are 100% deterministic, audit-traceable, and tamper-resistant.
  - Verification gates from Phase 5 are strictly enforced prior to public ticket issuance or registration.
  - Zero regression on existing routes (139 backend automated tests passing across 8 test suites).

---

## ADR-021: Event Membership Architecture & Granular Role-Based Access Control (Phase 7)
- **Status**: IMPLEMENTED
- **Context**: Events require cross-functional operational teams (Coordinators, Volunteers, Mentors, Evaluators) collaborating with Hosts. Platform roles must remain flat (`platformRole: 'USER'`), while roles and permissions are strictly event-scoped. Plain-text credential distribution over email violates security invariants.
- **Decision**:
  1. **Canonical `event_members` Collection**:
     - Modeled in `server/src/db/mongo/models/event-member.model.ts` with compound unique indexes (`{ eventId: 1, userEmail: 1 }` and `{ eventId: 1, userId: 1 }`).
     - Distinct roles: `HOST`, `COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR`.
     - 14 granular permissions (`MANAGE_EVENT_SETTINGS`, `MANAGE_STAFF`, `MANAGE_ATTENDEES`, `IMPORT_ATTENDEES`, `CONFIGURE_CREDENTIALS`, `GENERATE_CREDENTIALS`, `DOWNLOAD_CREDENTIALS`, `SCAN_CREDENTIALS`, `VIEW_ASSIGNED_TASKS`, `UPDATE_ASSIGNED_TASKS`, `MENTOR_ASSIGNED_TEAMS`, `SCORE_ASSIGNED_TEAMS`, `VIEW_EVALUATION_RESULTS`, `EXPORT_EVENT_DATA`).
  2. **Cryptographic One-Time Invitation Token Workflow**:
     - Generated using `crypto.randomBytes(32).toString('hex')` (64-character token) with 72-hour TTL.
     - Token is excluded by default from queries (`select: false`).
     - Acceptance route (`POST /api/events/invitations/accept`) validates token expiration and strictly enforces email matching between the invitee and the authenticated Supabase session.
  3. **Event RBAC Middleware (`requireEventPermission`)**:
     - Implemented in `server/src/middlewares/rbac.middleware.ts`.
     - Validates event ownership, active event membership permissions, or platform administrator status.
     - Downstream handlers receive attached `req.eventMembership`.
  4. **Staff Management UI (`EventStaffCard` & `AcceptInvitationPage`)**:
     - Built `client/src/components/events/EventStaffCard.tsx` with member roster, status tags, role badges, invitation link generator, volunteer scanner toggle, and revoke access action.
     - Built `client/src/pages/AcceptInvitationPage.tsx` mounted at `/invite/accept`.
     - Full compliance with `.agents/skills/frontend-design` (emerald `#10b981` accents, neutral dark surfaces, zero purple/indigo).
- **Consequences**:
  - Global user identity is preserved; no duplicate identity models or elevated global roles are introduced.
  - Granular delegation is enforced: volunteers can be granted ticket scanning without administrative permissions.
  - Full test suite passing (151 backend automated tests passing across 9 test suites; 0 build errors on client and server).

---

## ADR-022: Volunteer & Coordinator Management (Staff Operations & Task Engine) (Phase 8)
- **Status**: IMPLEMENTED
- **Context**: On-site event logistics require delegating duties, check-in gates, and field stations to coordinators and volunteers without granting host master credentials or exposing financial configurations. Dynamic scanning access must be manageable in real-time.
- **Decision**:
  1. **Canonical `event_tasks` Collection**:
     - Modeled in `server/src/db/mongo/models/event-task.model.ts` with compound indexes (`{ eventId: 1, status: 1 }`, `{ eventId: 1, station: 1 }`, `{ eventId: 1, assignedMemberIds: 1 }`).
     - Standardized categories: `REGISTRATION`, `SECURITY`, `LOGISTICS`, `HOSPITALITY`, `TECHNICAL`, `GENERAL`.
     - Standardized statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
     - Priority ratings: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
  2. **Layered Staff & Task Operations**:
     - Repository: `server/src/modules/events/repositories/mongo-event-task.repository.ts`.
     - Service: `server/src/modules/events/services/event-task.service.ts` enforcing zero-trust event scoping and coordinator management rights.
     - Controllers & Routes: mounted at `/api/events/:eventId/tasks`.
  3. **Dynamic Scanner Delegation**:
     - Coordinators and Hosts can dynamically grant or revoke `SCAN_CREDENTIALS` on volunteers via `POST /api/events/:eventId/tasks/members/:memberId/scanner`.
  4. **Volunteer Console & Task Manager UI**:
     - Built `EventTaskManagerCard` (`client/src/components/events/EventTaskManagerCard.tsx`) embedded within event detail views.
     - Built `VolunteerConsolePage` (`client/src/pages/VolunteerConsolePage.tsx`) mounted at `/events/:eventId/staff-console` providing field staff with assigned station instructions and direct 1-tap scanner access.
     - Full compliance with `.agents/skills/frontend-design` (emerald `#10b981` accents, obsidian `#121215` surfaces, zero forbidden violet/indigo colors).
- **Consequences**:
  - Clear operational separation of concerns: Coordinators manage logistics; Volunteers execute assigned shifts with restricted data visibility.
  - 10 test suites passing (164 automated backend tests, 0 failures, 0 build errors on client and server).

---

## ADR-023: Mentor & Evaluator System Architecture (Phase 9)
- **Status**: IMPLEMENTED
- **Context**: Hackathons, conferences, and competitions require domain mentors and evaluation panels. To prevent bias and preserve competition integrity:
  1. Mentors and judges must only see targets, tracks, or cohorts specifically assigned to them.
  2. Competing judges' scores and unassigned team tracks must remain masked (blind review isolation).
  3. Mentors need structured consultation logging to track guidance provided to teams.
  4. Platform roles must remain flat (`platformRole: 'USER'`), mapping mentors and evaluators through event-scoped `event_members`.
- **Decision**:
  1. **Canonical `event_assignments` Collection**:
     - Modeled in `server/src/db/mongo/models/event-assignment.model.ts` with compound indexes:
       - Unique constraint: `{ eventId: 1, memberId: 1, targetName: 1 }`
       - Query indexes: `{ eventId: 1, role: 1 }`, `{ eventId: 1, track: 1 }`, `{ memberId: 1, status: 1 }`
     - Assignment roles: `MENTOR`, `EVALUATOR`.
     - Target types: `TRACK`, `TEAM`, `GENERAL`.
     - Embedded subdocuments: `mentorshipLogs: [{ authorEmail, note, timestamp }]`.
  2. **Layered Architecture & Strict Data Isolation**:
     - Repository: `server/src/modules/events/repositories/mongo-event-assignment.repository.ts`.
     - Service: `server/src/modules/events/services/event-assignment.service.ts` enforcing least-privilege scoping:
       - Host/Coordinator: manage assignments across tracks (`GET /`, `POST /`, `DELETE /:assignmentId`).
       - Mentor/Evaluator: restricted workspace (`GET /my-assignments`) returning only rows where `memberId == callerMemberId`.
       - Mentorship logging: `POST /:assignmentId/logs` appending timestamped consultation notes.
     - Controller: `server/src/modules/events/controllers/event-assignment.controller.ts`.
     - Routes: `server/src/modules/events/routes/event-assignment.routes.ts` mounted at `/api/events/:eventId/assignments`.
  3. **Frontend Integration**:
     - API Client: Added assignment CRUD & log endpoints in `client/src/api/events.ts`.
     - Host Console: `EventAssignmentCard` mounted in `EventDetailPage.tsx` with role filter, track chips, member select modal, and delete confirmation.
     - Restricted Portal: `MentorEvaluatorWorkspacePage` mounted at `/events/:eventId/review-workspace` with blind review guidelines, track targets, and consultation logging modal.
     - Design: Obsidian surfaces (`#09090b` / `#121215`), Emerald accents (`#10b981`), zero purple/indigo/violet classes.
- **Consequences**:
  - Blind review isolation is fully established in data access layer and UI.
  - Zero cross-track leakage or privilege escalation across events.
  - 11 test suites passing (175 automated backend tests, 0 failures; 0 build errors across client and server).

---

## ADR-024: Event Team Management Architecture (Phase 10)
- **Status**: IMPLEMENTED
- **Context**: Hackathons, competitions, and collaborative workshops require group-based registration and project tracking. Teams need clear track assignments, table/booth allocations, project submission repositories, and bounded member rosters without polluting the global user identity model.
- **Decision**:
  1. **Canonical `event_teams` Collection**:
     - Modeled in `server/src/db/mongo/models/event-team.model.ts` with compound indexes:
       - Unique index: `{ eventId: 1, teamName: 1 }`
       - Query indexes: `{ eventId: 1, track: 1 }`, `{ eventId: 1, status: 1 }`, `{ eventId: 1, leaderEmail: 1 }`
     - Status workflow: `REGISTERED` → `FORMED` → `SUBMITTED` → `DISQUALIFIED` → `WITHDRAWN`.
     - Embedded subdocuments: `members: [{ name, email, role, checkedIn }]`.
     - Bounded roster capacity: Maximum 6 members per team; duplicate emails within a team are strictly rejected.
     - Leader protection: The team leader cannot be removed from their own team roster.
  2. **Layered Architecture**:
     - Repository: `server/src/modules/events/repositories/mongo-event-team.repository.ts`.
     - Service: `server/src/modules/events/services/event-team.service.ts` enforcing least-privilege scoping:
       - Hosts and Coordinators can manage all event teams and table allocations.
       - Team Leaders can manage their team's project links, repository URL, demo URL, and roster members.
       - Status updates to `SUBMITTED` automatically register `submittedAt` timestamp.
     - Controller: `server/src/modules/events/controllers/event-team.controller.ts`.
     - Routes: `server/src/modules/events/routes/event-team.routes.ts` mounted at `/api/events/:eventId/teams`.
  3. **Frontend Integration**:
     - API Client: Added team methods (`getTeams`, `getTeamById`, `createTeam`, `updateTeam`, `deleteTeam`, `addTeamMember`, `removeTeamMember`) and TypeScript types in `client/src/api/events.ts`.
     - Component: Built `EventTeamManagerCard` (`client/src/components/events/EventTeamManagerCard.tsx`) mounted inside `EventDetailPage.tsx`. Features metrics banner, search bar, track and status filtering, team registration modal, member addition modal, and edit/table allocation modal.
- **Consequences**:
  - Full support for hackathon cohort management and project submissions.
  - Ready for Phase 11 rubric evaluation scoring engine against submitted teams.
  - 12 test suites passing (189 automated backend tests, 0 failures; 0 build errors across client and server).

---

## ADR-025: Evaluation & Scoring Engine Architecture (Phase 11)
- **Status**: IMPLEMENTED
- **Context**: Hackathons, competitions, and conferences require objective, standardized judging across diverse tracks and project teams. To maintain judging integrity:
  1. Judging rubrics must support weighted criteria, custom maximum scores, and configurable evaluation rounds.
  2. Scoring workflow must enforce explicit phase transitions (`OPEN` → `CLOSED` → `FINALIZED`).
  3. Strict blind review isolation must be enforced: Evaluators must never see competing judges' scores, and participants must not view the aggregate leaderboard until the host finalizes scoring.
  4. Dynamic leaderboard must aggregate average weighted scores, review counts, and criteria breakdowns in real time.
- **Decision**:
  1. **Canonical Collections**:
     - `event_rubrics` (`server/src/db/mongo/models/event-rubric.model.ts`):
       - Fields: `eventId`, `title`, `track`, `criteria: [{ key, label, maxScore, weight, description }]`, `scoringStatus` (`OPEN` | `CLOSED` | `FINALIZED`).
       - Indexes: `{ eventId: 1, scoringStatus: 1 }`, `{ eventId: 1, track: 1 }`.
     - `event_evaluations` (`server/src/db/mongo/models/event-evaluation.model.ts`):
       - Fields: `eventId`, `rubricId`, `teamId`, `evaluatorMemberId`, `evaluatorEmail`, `evaluatorName`, `scores: [{ criteriaKey, score, feedback }]`, `weightedTotal`, `generalFeedback`, `status`, `submittedAt`.
       - Compound Unique Index: `{ eventId: 1, teamId: 1, evaluatorMemberId: 1 }` (guarantees one scorecard per evaluator per team).
  2. **Layered Architecture & Strict Data Isolation**:
     - Repositories:
       - `server/src/modules/events/repositories/mongo-event-rubric.repository.ts`
       - `server/src/modules/events/repositories/mongo-event-evaluation.repository.ts` (with MongoDB aggregation pipeline for aggregate leaderboard averages).
     - Service: `server/src/modules/events/services/event-evaluation.service.ts` enforcing:
       - Host/Coordinator role requirement for rubric CRUD and status transitions.
       - Evaluator score submissions only when rubric scoring status is `OPEN`.
       - Weighted score calculation: `sum((score / maxScore) * weight)`.
       - Blind review isolation: Evaluators query only their own scorecards; public leaderboard query rejected with 403 Forbidden until scoring is `FINALIZED` (Hosts/Coordinators can view live preview).
     - Controller & Routes: `server/src/modules/events/controllers/event-evaluation.controller.ts` & `server/src/modules/events/routes/event-evaluation.routes.ts` mounted at `/api/events/:eventId`.
  3. **Frontend Integration**:
     - API Client: Extended `client/src/api/events.ts` with rubric CRUD, evaluation submission, scorecard retrieval, and leaderboard fetching.
     - Host Management Card: Built `EventEvaluationCard` (`client/src/components/events/EventEvaluationCard.tsx`) mounted inside `EventDetailPage.tsx`. Supports rubric creation with criteria builder, phase transitions, and live ranked leaderboard.
     - Evaluator Workspace: Enhanced `MentorEvaluatorWorkspacePage` (`client/src/pages/MentorEvaluatorWorkspacePage.tsx`) with an interactive scoring modal featuring criteria sliders, real-time weighted score calculation preview, feedback input, and submission history.
- **Consequences**:
  - Full end-to-end evaluation lifecycle with mathematical rigor and blind review integrity.
  - 13 test suites passing (198 automated backend tests, 0 failures; 0 build errors across client and server).

## ADR-026: Generic Credential Architecture & Abstraction Engine (Phase 12)
- **Status**: IMPLEMENTED
- **Context**: Ticketification supports diverse event archetypes (Concerts, Hackathons, Conferences, Festivals, Workshops). Each archetype uses distinct credential terminology (Ticket, Participant Pass, Delegate Badge, Wristband) and distinct access policies (Single-use, Reusable, Multi-day, Worker Unassigned).
  Key architectural requirements:
  1. A single generic credential model must represent all credential variants across all event types without polymorphic schema bloat.
  2. Monotonic sequence counter per event (`seq = 1, 2, 3...`) formatted as `<PREFIX>-00001` must be atomic and race-condition free under concurrent issuance.
  3. Verification tokens must be opaque 64-character cryptographic hex strings with zero embedded PII.
  4. Public scanner/token lookup endpoint (`/api/credentials/verify-token/:token`) must verify credential validity while strictly protecting attendee email, phone number, and internal system IDs.
  5. Hosts and Coordinators require UI controls to issue single credentials, provision batches of reusable worker passes, assign unassigned worker passes on-site, and revoke compromised credentials with immutable audit reasons.
- **Decision**:
  1. **Canonical MongoDB Schemas**:
     - `event_credentials` (`server/src/db/mongo/models/event-credential.model.ts`):
       - Core fields: `eventId`, `credentialType`, `sequenceNumber`, `sequenceFormatted`, `verificationToken` (64-char crypto hex), `status` (`ACTIVE` | `REVOKED` | `EXPIRED` | `VOIDED`), `holder: { name, email, roleCategory }`, `usagePolicy` (`SINGLE_USE` | `REUSABLE` | `MULTI_DAY` | `WORKER_UNASSIGNED`), `asset: { storagePath, publicUrl, qrPayload, generatedAt }`, `checkInCount`, `lastCheckInAt`, `issuedAt`, `expiresAt`, `revokedAt`, `revocationReason`, `metadata`, `createdBy`.
       - Compound Unique Indexes: `{ eventId: 1, sequenceNumber: 1 }` (guarantees sequence uniqueness), `{ verificationToken: 1 }` (guarantees O(1) scanner lookup).
     - `event_sequence_counters` (`server/src/db/mongo/models/event-sequence-counter.model.ts`):
       - Dedicated atomic sequence counter collection using `findOneAndUpdate({ eventId }, { $inc: { lastSequenceNumber: 1 } }, { new: true, upsert: true })`.
  2. **Layered Architecture & Security Boundaries**:
     - Repositories: `server/src/modules/events/repositories/mongo-event-credential.repository.ts` providing atomic sequence increments, single & batch creation, status/policy/search queries, aggregated metrics calculation (`totalIssued`, `activeCount`, `checkedInCount`, `revokedCount`), revocation, and holder assignment.
     - Service: `server/src/modules/events/services/event-credential.service.ts` providing:
       - Terminology prefix derivation (`clean.includes('BADG') -> 'BDG'`, `'TICK' -> 'TIC'`, `'PASS' -> 'PASS'`, `'INVIT' -> 'INV'`).
       - Zero-trust RBAC authorization (Host/Coordinator evaluated via MongoDB `event_members`).
       - Single & batch worker credential generation.
       - Zero-PII public token verification lookup: returns attendee name, event name, sequence ID, status, and usage policy while stripping email and internal database IDs.
     - Controller & Routes: Protected router `/:eventId/credentials` mounted in `event.routes.ts` and public router `/api/credentials/verify-token/:token` mounted in `app.ts`.
  3. **Frontend Implementation**:
     - API Client: Extended `client/src/api/events.ts` with Phase 12 credential interfaces and methods.
     - Host Management Card: Created `EventCredentialManagerCard` (`client/src/components/events/EventCredentialManagerCard.tsx`) with Obsidian/Emerald theme tokens, executive metrics cards, search & tab filters, credentials data table with sequence tags and token clipboard actions, single issuance modal, batch worker provisioning modal, holder assignment modal, revocation audit modal, and zero-PII public verification inspection modal. Mounted inside `EventDetailPage.tsx`.
- **Consequences**:
  - Unified credential layer across conferences, concerts, hackathons, and festivals.
  - Concurrency-safe monotonic sequence allocation with 0 collisions.
  - Zero PII leakage across public verification and scanner queries.
  - 14 test suites passing (209 automated tests, 100% pass rate; 0 build errors across client and server).

## ADR-027: Visual Credential Templates & Sharp Rasterization Engine (Phase 13)
- **Status**: IMPLEMENTED
- **Context**: Visual credentials (badges, passes, tickets, wristbands) must be generated with pixel-accurate layouts tailored to diverse event archetypes (Conferences, Concerts, Hackathons, Festivals, Workshops).
  Key architectural requirements:
  1. Reusable template schemas supporting standard dimensions (Badge: 1620x2025, Ticket: 1920x800, Pass: 1440x2160, Worker Pass: 1280x1920) and customizable coordinate fields (`{{name}}`, `{{sequence}}`, `{{qr}}`, `{{role}}`, `{{eventName}}`, `{{date}}`, `{{venue}}`).
  2. Pre-seeded platform global presets (`CONFERENCE_BADGE`, `CONCERT_TICKET`, `HACKATHON_PASS`, `WORKER_PASS`) that hosts can preview, clone, and customize for specific events.
  3. Bounded-memory Sharp compositing pipeline enforcing Render 512MB RAM constraints (`sharp.cache(false)`, `sharp.concurrency(1)`).
  4. Real-time live visual preview generation returning base64 data URLs for immediate UI feedback in the template designer.
  5. Asynchronous asset rendering producing verified binary PNGs (`0x89504E47` magic bytes) uploaded to Supabase Storage at `events/:eventId/credentials/:credentialId.png` and bound to the MongoDB credential document.
  6. Zero network blocking in SVG overlays: all fonts must resolve locally via bundled Fontconfig without external HTTP `@import` calls.
- **Decision**:
  1. **Canonical MongoDB Schema**:
     - `event_credential_templates` (`server/src/db/mongo/models/event-credential-template.model.ts`):
       - Fields: `eventId` (nullable for global presets), `name`, `description`, `presetId`, `isDefault`, `dimensions: { width, height, orientation }`, `fields: [{ fieldKey, label, x, y, width, height, fontSize, fontWeight, fontColor, textAlign, isVisible }]`, `backgroundStoragePath`, `backgroundColor`, `accentColor`, `createdBy`.
       - Compound Indexes: `{ eventId: 1, isDefault: 1 }` (ensures fast default resolution), `{ presetId: 1 }`.
  2. **Layered Architecture & Engine Execution**:
     - Repository: `server/src/modules/events/repositories/mongo-event-credential-template.repository.ts` providing idempotent preset seeding, event template queries, default template management, cloning, updating, and deleting.
     - Rendering Service: `server/src/modules/events/services/event-credential-rendering.service.ts` using native Sharp libvips compositing: generates Level H high-density QR codes (opaque 64-char verification token URL), generates SVG text overlay with XML escaping, merges background and layers, asserts 4-byte PNG magic header, and uploads directly to Supabase Storage.
     - Orchestration Service: `server/src/modules/events/services/event-credential-template.service.ts` enforcing RBAC (Host/Coordinator via `event_members`), live preview simulation, preset cloning, and credential asset rendering.
     - Controller & Routes: Protected router `/:eventId/credential-templates` mounted in `event.routes.ts` and asset render endpoint `POST /:eventId/credentials/:credentialId/render` mounted in `event-credential.routes.ts`.
  3. **Frontend Implementation**:
     - API Client: Extended `client/src/api/events.ts` with Phase 13 interfaces and API functions.
     - Template Designer Card: Created `EventCredentialTemplateCard` (`client/src/components/events/EventCredentialTemplateCard.tsx`) with Obsidian/Emerald theme tokens, active default template banner, 4 preset cloning cards, template registry table with default toggling, real-time live Sharp preview modal, and field coordinate editor. Mounted into `EventDetailPage.tsx`.
- **Consequences**:
  - Deterministic visual credential rendering compliant with Render 512MB RAM bounds.
  - Zero PII in QR payloads (opaque verification URL).
  - 15 test suites passing (221 automated tests, 100% pass rate; 0 build errors across client and server).

## ADR-028: High-Throughput QR Verification & Atomic Check-in Engine (Phase 14)
- **Status**: IMPLEMENTED
- **Context**: Day-of-event entry gates experience sudden traffic spikes with multiple volunteers scanning single-use passes simultaneously.
  Key architectural requirements:
  1. High-concurrency race condition defense: for `SINGLE_USE` passes, exactly one scan must succeed when multiple gate scanners scan simultaneously.
  2. Multi-entry support: `REUSABLE` and `REUSABLE_WORKER` passes allow multiple admissions while incrementing `checkInCount` and recording `lastCheckedInAt`.
  3. On-site worker assignment: unassigned worker passes require or prompt for on-the-fly crew member name registration on first scan.
  4. Immutable audit trail: every scan attempt (success, duplicate rejection, revoked, expired) must log to `event_credential_checkins`.
  5. Zero-trust staff RBAC: only Hosts, Coordinators, and Volunteers possessing `SCAN_CREDENTIALS` or `MANAGE_ATTENDEES` permissions can execute check-ins. Unauthorized volunteers and non-members receive HTTP 403 Forbidden.
  6. Live analytics: real-time stream endpoint and 15-minute entry velocity calculations.
- **Decision**:
  1. **Canonical MongoDB Schema**:
     - `event_credential_checkins` (`server/src/db/mongo/models/event-credential-checkin.model.ts`):
       - Fields: `eventId`, `credentialId`, `scannedBy`, `scannerEmail`, `scannerRole`, `scannedAt`, `scanStatus` (`SUCCESS` | `ALREADY_CHECKED_IN` | `REVOKED` | `EXPIRED` | `UNAUTHORIZED`), `usagePolicy`, `gate`, `holderSnapshot: { name, category, formattedId }`, `notes`.
       - Compound Indexes: `{ eventId: 1, scannedAt: -1 }`, `{ credentialId: 1, scannedAt: -1 }`, `{ eventId: 1, scanStatus: 1 }`, `{ eventId: 1, gate: 1 }`.
  2. **Layered Architecture & Atomic Updates**:
     - Repository: `server/src/modules/events/repositories/mongo-event-credential.repository.ts` implementing `atomicCheckInSingleUse` (`findOneAndUpdate({ _id, eventId, status: 'ACTIVE', usagePolicy: 'SINGLE_USE' }, { $set: { status: 'CHECKED_IN', firstCheckedInAt: now, lastCheckedInAt: now }, $inc: { checkInCount: 1 } })`) and `atomicCheckInReusable`.
     - Checkin Repository: `server/src/modules/events/repositories/mongo-event-credential-checkin.repository.ts` providing immutable audit logging, filterable live queries, and 15-minute velocity aggregations.
     - Service: `server/src/modules/events/services/event-credential-checkin.service.ts` verifying RBAC permissions via `event_members`, token validation, status dispatch, worker name binding, and audit emission.
     - Controller & Routes: `server/src/modules/events/controllers/event-credential-checkin.controller.ts` mounted in `event-credential.routes.ts` (`POST /:eventId/credentials/checkin`, `GET /:eventId/credentials/checkins`, `GET /:eventId/credentials/checkin-stats`).
  3. **Frontend Implementation**:
     - API Client: Added Phase 14 interfaces and `eventsApi` check-in methods in `client/src/api/events.ts`.
     - Component: Created `EventCheckinScannerCard` (`client/src/components/events/EventCheckinScannerCard.tsx`) with Obsidian/Emerald theme tokens, web audio synthesized chimes (success/error/prompt), live stats cards, gate selector, token input with barcode scanner auto-read, real-time activity table, and unassigned worker modal. Mounted in `EventDetailPage.tsx` and `VolunteerConsolePage.tsx`.
- **Consequences**:
  - 100% race-condition proof single-use gate validation (0 double check-ins).
  - Frictionless on-site worker onboarding and reusable staff entries.
  - 16 test suites passing (232 automated tests, 100% pass rate; 0 build errors across client and server).

## ADR-029: Asynchronous Bulk Credential Generation & Job Queue Engine (Phase 15)
- **Status**: IMPLEMENTED
- **Context**: Importing attendee rosters with 100 to 20,000 participants and generating visual PNG passes inside synchronous HTTP requests causes gateway timeouts (Render 30s limit), connection drops, and memory exhaustion.
  Key architectural requirements:
  1. Multi-format spreadsheet parsing (`.xlsx`, `.xls`, `.csv`) up to 15MB with fuzzy column synonym auto-detection (`name`, `email`, `phone`, `category`, `organization`) and row-by-row syntax/error validation.
  2. Asynchronous job queue engine (`event_jobs` collection) with `HTTP 202 Accepted` response pattern and real-time progress polling (`total`, `processed`, `succeeded`, `failed`, `percentage`).
  3. Monotonic sequence reservation via `allocateSequenceBlock(eventId, count)` guaranteeing zero collision or numbering gaps across concurrent workers.
  4. Memory-bounded Sharp rasterization: processed in bounded chunks of 2 with `sharp.concurrency(1)` and `sharp.cache(false)` strictly complying with Render 512MB RAM constraints (ADR-007, ADR-008).
  5. Zero-Trust staff RBAC: only Hosts and Coordinators verified via MongoDB `event_members` can enqueue or cancel jobs.
- **Decision**:
  1. **Canonical MongoDB Schema**:
     - `event_jobs` (`server/src/db/mongo/models/event-job.model.ts`):
       - Fields: `eventId`, `jobType` (`IMPORT_CREDENTIALS` | `BULK_RENDER_ASSETS` | `EXPORT_CREDENTIALS`), `status` (`QUEUED` | `PROCESSING` | `COMPLETED` | `FAILED` | `CANCELLED`), `progress: { total, processed, succeeded, failed, percentage }`, `payload`, `result: { importedCount, renderedCount, exportedCount, downloadUrl, errorLog }`, `errorMessage`, `startedAt`, `completedAt`, `createdBy`.
       - Compound Indexes: `{ eventId: 1, createdAt: -1 }`, `{ status: 1, createdAt: 1 }`.
  2. **Layered Architecture & Engine Execution**:
     - Repository: `server/src/modules/events/repositories/mongo-event-job.repository.ts` providing job creation, atomic progress increments (`incrementProgress`), and lifecycle transitions (`markStarted`, `markCompleted`, `markFailed`, `markCancelled`).
     - Sequence Allocation: `allocateSequenceBlock(eventId, count)` in `mongo-event-credential.repository.ts` atomically reserving contiguous sequence blocks in `event_sequence_counters`.
     - Spreadsheet Parser: `server/src/modules/events/services/event-import-parser.service.ts` using `xlsx` with two-pass exact & synonym mapping and row syntax validation.
     - Worker Service: `server/src/modules/events/services/event-job-queue.service.ts` executing background jobs in bounded batches with cancellation checks, atomic sequence assignment, and bounded Sharp compositing.
     - Controller & Routes: `server/src/modules/events/controllers/event-job.controller.ts` and `event-job.routes.ts` with Multer 15MB buffer upload mounted at `/:eventId/jobs`.
  3. **Frontend Implementation**:
     - API Client: Added Phase 15 types and endpoints (`previewImportSpreadsheet`, `createImportJob`, `createBulkRenderJob`, `getEventJobs`, `getEventJobStatus`, `cancelEventJob`) in `client/src/api/events.ts`.
     - UI Component: Created `EventImportBulkModal` (`client/src/components/events/EventImportBulkModal.tsx`) with drag & drop ingestion, live column detection table, real-time polling progress bar, error log accordion, and background job history. Mounted into `EventCredentialManagerCard.tsx`.
- **Consequences**:
  - Handles massive attendee rosters reliably without exceeding memory or timing out.
  - Zero numbering collisions across concurrent imports.
  - 17 test suites passing (243 automated tests, 100% pass rate; 0 build errors across client and server).

## ADR-030: Asynchronous Export Jobs & Presigned Storage Downloads (Phase 16)
- **Status**: IMPLEMENTED
- **Context**: Exporting visual passes (ZIP archives) and attendee telemetry (Excel / CSV) for events with thousands of participants can easily generate multi-hundred megabyte payloads. Buffering or proxying these large binaries through Node.js heap memory or inside synchronous HTTP connections causes Render 512MB RAM OOM crashes and 30s gateway timeouts.
  Key architectural requirements:
  1. Asynchronous `HTTP 202 Accepted` job pattern integrated with the `event_jobs` collection (`jobType: 'EXPORT_CREDENTIALS'`).
  2. Multi-format support: `ZIP_PASSES` (compressed ZIP archive of rendered PNG passes), `ROSTER_XLSX` (full attendee Excel report with check-in timestamps, gates, and tokens), and `ROSTER_CSV` (raw telemetry log).
  3. Memory-bounded streaming via `archiver` and `PassThrough` stream to ensure archives stream without buffering in Node memory.
  4. Presigned Supabase Storage downloads: uploaded export binaries reside directly under `events/${eventId}/exports/` and are accessed via 24-hour presigned direct download URLs, completely bypassing Node.js bandwidth and memory limits.
  5. Zero-Trust staff RBAC: only Hosts and Coordinators evaluated via MongoDB `event_members` can enqueue exports and receive download links.
- **Decision**:
  1. **Canonical Schema Extensions**:
     - `JobType`: Extended with `'EXPORT_CREDENTIALS'`.
     - `IJobResult`: Extended with `exportedCount`, `downloadUrl`, `storagePath`, and `fileSizeBytes`.
  2. **Layered Architecture & Engine Execution**:
     - Export Service: `server/src/modules/events/services/event-export.service.ts` managing streaming ZIP packaging (`archiver`), XLSX/CSV generation (`xlsx`), Supabase Storage uploading, and 24-hour presigned URL generation.
     - Storage Client: Extended `SupabaseStorageService` with `uploadExportFile` and `createPresignedDownloadUrl`.
     - Job Queue Integration: `EventJobQueueService.enqueueExportJob` accepting export configurations, routing execution asynchronously, and tracking progress percentages.
     - Controller & Routes: `POST /:eventId/jobs/export` mounted in `event-job.routes.ts`.
  3. **Frontend Implementation**:
     - API Client: Added Phase 16 types (`ExportJobFormat`, `CreateExportJobPayload`) and `eventsApi.createExportJob` in `client/src/api/events.ts`.
     - UI Component: Enhanced `EventImportBulkModal` with an "Export Archive & Reports" tab featuring 3 export option cards, real-time progress bar, and instant presigned direct download button with file size telemetry.
- **Consequences**:
  - Organizers can download massive zip pass archives and complete attendee rosters with zero risk of server crashes.
  - 18 test suites passing (251 automated tests, 100% pass rate; 0 build errors across client and server).

---

## ADR-031: Storage Quota Governance, Render 512MB RAM Bounding, & Devanagari Typography (Phase 17)
- **Status**: IMPLEMENTED
- **Context**: Operating on cost-effective infrastructure (Render 512MB RAM Linux containers and Supabase Storage tier bounds) requires strict memory governance, deterministic typography, and disk quota controls:
  1. High-resolution rasterization can exhaust libvips memory outside V8 if caching is enabled or concurrency is unconstrained.
  2. Complex Indic script characters (Hindi, Sanskrit, Marathi) render with broken glyphs or empty boxes on containerized Linux servers without base64 `@font-face` font embedding.
  3. Indefinite accumulation of multi-hundred megabyte export ZIP archives and CSV files leads to disk bloat and exceeded storage quotas.
- **Decision**:
  1. **Memory Budget & Sharp Optimization**:
     - Enforced `sharp.cache(false)` and `sharp.concurrency(1)` across the modern credential rendering pipeline.
     - Implemented `MemoryBudgetGovernor` (`server/src/utils/memory-budget-governor.ts`) to monitor process RSS against a 400MB threshold, proactively triggering garbage collection and throttling execution if memory becomes elevated.
     - Eliminated risk of headless Chromium crashes on minimal cloud containers.
  2. **Deterministic Indic & Devanagari Typography**:
     - Embedded bundled Google `NotoSansDevanagari-Bold.ttf` directly as base64 inside SVG templates via `@font-face` in `EventCredentialRenderingService`.
     - Injected `'Noto Sans Devanagari'` in the typography fallback cascade for all credential field templates, guaranteeing deterministic conjunct and matra shaping with zero network requests.
  3. **Storage Quota Governance & Stale Export Cleanup**:
     - Implemented `EventStorageGovernanceService` (`server/src/modules/events/services/event-storage-governance.service.ts`) enforcing a default 1024MB (1GB) event quota boundary.
     - Added `getEventStorageMetrics` providing real-time storage breakdowns across passes, exports, and templates.
     - Added `cleanupStaleExports` to identify and purge temporary ZIP/XLSX/CSV archives older than 24 hours from Supabase Storage and invalidate expired download links.
     - Enforced pre-flight quota assertions (`assertStorageAllowance`) before enqueuing bulk credential rendering or export jobs.
     - Mounted routes under `GET /api/events/:eventId/storage` and `POST /api/events/:eventId/storage/cleanup` protected by Zero-Trust RBAC.
  4. **Frontend Implementation**:
     - Added storage telemetry types and API client endpoints in `client/src/api/events.ts`.
     - Created interactive Storage & Quota tab in `EventImportBulkModal.tsx` with live quota usage bar, breakdown cards, one-click stale export purge action, and recent export telemetry table.
- **Consequences**:
  - Memory consumption remains strictly bounded within Render 512MB constraints.
  - Flawless Indic/Hindi credential text shaping across all operating systems.
  - Transparent storage tracking with automated quota reclamation.
  - 30 test suites passing (356 automated tests, 100% pass rate; 0 build errors across client and server).

---

## ADR-032: Immutable Audit Logging & Rate-Limited Security Infrastructure (Phase 18)
- **Status**: IMPLEMENTED
- **Context**: Operating access credentials, ticket revocations, attendee telemetry, and staff permissions across multi-tenant events requires enterprise-grade auditability, defense-in-depth rate limiting, and zero-trust event scoping:
  1. High-privilege mutations (staff invitations/removals, pass revocations, storage purges, lifecycle changes) must have an append-only, tamper-proof record that cannot be retroactively modified or deleted even by database administrators.
  2. Public and staff endpoints are vulnerable to credential stuffing, denial-of-service, or export flooding if unconstrained by token-bucket rate limits with endpoint-aware burst thresholds.
  3. Sensitive audit trail records must be strictly isolated by event boundary (`eventId`) to prevent IDOR vulnerabilities across events.
- **Decision**:
  1. **Append-Only Immutable Ledger Schema**:
     - Created `audit_logs` collection (`AuditLogModel` in `server/src/db/mongo/models/audit-log.model.ts`) with `timestamps: { createdAt: true, updatedAt: false }`.
     - Attached pre-hooks blocking `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, throwing invariant violation errors if mutations or deletions are attempted.
     - Created compound indexes on `{ eventId: 1, createdAt: -1 }`, `{ eventId: 1, action: 1, createdAt: -1 }`, and `{ actorId: 1, createdAt: -1 }`.
  2. **Layered Service & Mutation Integration**:
     - Implemented `MongoAuditLogRepository` and `AuditService` with safe ID resolution supporting both MongoDB ObjectIds and external/Supabase string identifiers.
     - Wired audit recording into high-privilege mutations:
       - `event-member.controller.ts`: `STAFF_INVITED`, `STAFF_REMOVED`.
       - `event-credential.controller.ts`: `CREDENTIAL_REVOKED`.
       - `event-storage.controller.ts`: `STORAGE_PURGED`.
  3. **Multi-Tier Rate Limiting**:
     - Implemented endpoint-aware rate limiters in `server/src/middlewares/rate-limit.middleware.ts`:
       - `exportRateLimiter`: 10 requests / 60 seconds (burst limit for large ZIP/XLSX generation).
       - `auditLogRateLimiter`: 60 requests / 60 seconds (anti-scraping protection for audit trail).
       - `scannerRateLimiter`: 120 requests / 60 seconds (high-throughput gate access).
  4. **Zero-Trust RBAC & IDOR Boundary**:
     - Mounted `GET /api/events/:eventId/audit-logs` guarded by `authMiddleware` and `requireEventRole(['HOST', 'ADMIN'])`.
     - Enforced event-scoped queries in the repository layer to guarantee zero cross-event leakage.
  5. **Frontend Client & UI Integration**:
     - Extended `client/src/api/events.ts` with `AuditLogItem`, `AuditLogResponse`, and `eventsApi.getEventAuditLogs`.
     - Created `EventAuditLogCard.tsx` featuring live event activity stream, actor role badges, action filters, timestamp formatting, and expandable metadata inspection.
     - Mounted `EventAuditLogCard` in `EventDetailPage.tsx`.
- **Consequences**:
  - Full traceability for all administrative actions with schema-enforced write-once immutability.
  - Granular defense against DoS and export flooding.
  - Zero-trust RBAC ensures only authorized Hosts can inspect event audit trails.
  - 31 test suites passing (364 automated tests, 100% pass rate; 0 build errors across client and server).

---

## ADR-033: Context-Aware Host Dashboard & Modular Event Operating Console (Phase 19)
- **Date**: 2026-10-10
- **Status**: IMPLEMENTED
- **Context**:
  1. The platform manages diverse event types (Hackathons, Conferences, Concerts, Festivals, Workshops, Competitions, etc.). Previously, `EventDetailPage.tsx` displayed a monolithic, unorganized vertical stack of 10+ cards, forcing hosts of a Concert or Workshop to scroll past irrelevant Hackathon rubrics, tracks, and team submission widgets.
  2. Operating day-of-event logistics requires an overarching telemetry ribbon (credential issuance volume, 15-minute gate scan velocity, staff on duty, hacker team counts, storage quota consumption) without issuing 6 uncoordinated roundtrips from the frontend.
  3. Feature modularity requires zero-trust server-side feature derivation: the backend must provide authoritative feature flags (`hasCompetition`, `hasWorkshops`, `hasSeating`, `hasCheckinVelocity`, `hasBulkExports`) while the frontend organizes operational tools into focused, context-aware workspaces.
- **Decision**:
  1. **Unified Dashboard Telemetry Service & Endpoint**:
     - Created `EventDashboardService` (`server/src/modules/events/services/event-dashboard.service.ts`) aggregating metrics in parallel (`Promise.allSettled`):
       - Credentials: Total issued, active, checked-in, revoked, expired, and check-in rate percentage.
       - Scan Velocity: Scans completed in the last 15 minutes via `checkinRepo.getCheckinStats(eventId)`.
       - Staff Breakdown: Counts by role (`HOST`, `COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR`).
       - Competition Cohorts: Total registered teams, active teams, average team size.
       - Storage Quota: Used bytes, limit bytes, percentage utilization.
       - Recent Audit Activity: Last 5 immutable audit log entries.
     - Implemented `deriveFeatures(eventType)` calculating contextual operational flags.
     - Mounted `GET /api/events/:eventId/dashboard-summary` on `EventDashboardController` protected by `authMiddleware` and `requireEventRole(['HOST', 'COORDINATOR', 'ADMIN'])`.
  2. **Modular Tab Operating Console (`ContextAwareHostConsole.tsx`)**:
     - Built an Obsidian/Emerald (`#090d16` canvas, `#111622` card containers, `#10b981` accents) operational console in `client/src/components/events/ContextAwareHostConsole.tsx`.
     - Live Top Hero Header: Displays event title, status, date/venue, contextual taxonomy badge (`HACKATHON CONSOLE`, `CONCERT CONSOLE`, `WORKSHOP CONSOLE`, etc.), public link, and quick edit trigger.
     - Operational KPI Ribbon: Real-time badges for Passes Issued, 15m Gate Velocity, Staff on Duty, Teams/Hackers, and Cloud Storage Quota %.
     - Contextual Tab Architecture:
       - **Overview**: Event status, verification tier badges, capacity progress bar, quick action shortcuts.
       - **Credentials & Access**: Bulk pass generation, roster import, template assignment, and credential list.
       - **Staff & Volunteers**: Role delegations, permission toggles, mentor & evaluator invitations.
       - **Competition & Tracks**: Tracks, team rosters, submission review, and rubric scoring. Dynamically hidden when `features.hasCompetition` is false.
       - **Gate & Check-in**: Live QR scanner launcher, check-in velocity statistics, manual search check-in.
       - **Audit Trail**: Real-time immutable audit log feed with actor filters and metadata inspection.
  3. **Mongoose Buffer Command Invariant**:
     - Configured `bufferCommands: false` on `AuditLogSchema` ensuring offline or mock unit test runs fail fast on unmocked database operations and are handled gracefully by `AuditService.record`'s `try/catch` block.
- **Consequences**:
  - Cluttered monolithic 10-card page eliminated in favor of an ergonomic, tabbed context-aware console.
  - Zero-Trust RBAC guarantees only Hosts and Coordinators access aggregated telemetry.
  - Non-competitive events (Concerts, Workshops, Webinars) are cleanly decluttered from judging rubrics and track controls.
  - All 32 automated test suites passing (372 tests, 100% pass rate; clean builds across client and server).

---

## ADR-034: Attendee Self-Service Platform, Personal Credential Wallet & Dynamic Teaming (Phase 20)
- **Date**: 2026-10-10
- **Status**: IMPLEMENTED
- **Context**:
  1. The platform previously focused primarily on the Host and Staff administrative surfaces (Phases 1–19). Participants had no dedicated, self-service entry point to discover their registrations, view credentials, or manage their hackathon team memberships.
  2. Operating diverse events (Hackathons, Conferences, Concerts, Bootcamps) requires self-registration with dynamic, event-type-specific questionnaire fields (dietary requirements, GitHub handle, track preference), atomic capacity checking, and immediate credential generation.
  3. Attendees require a centralized, cross-event "Wallet" (`/wallet`) allowing them to view and display high-contrast dynamic QR codes for day-of-event admission and download rendered PNG assets without relying on organizers to email passes.
- **Decision**:
  1. **Event Registration Data Schema & Invariants**:
     - Created `event_registrations` collection (`EventRegistrationModel` in `server/src/db/mongo/models/event-registration.model.ts`) with `timestamps: true` and `bufferCommands: false`.
     - Enforced idempotent unique registration compound index on `{ eventId: 1, userId: 1 }`, guaranteeing that multiple registration requests for the same event return the existing active registration and prevent duplicate passes.
     - Linked each registration to an `EventCredential` and optional `EventTeam`.
  2. **Layered Services & Workflow Orchestration**:
     - Built `EventRegistrationService` (`server/src/modules/events/services/event-registration.service.ts`):
       - `register(eventId, userSupabaseId, dto)`: Validates event lifecycle state (blocks `DRAFT`, `SUSPENDED`, `CANCELLED`), checks capacity (`event.registration.capacity`), auto-issues an active credential via `EventCredentialService.issueRegistrationCredential`, saves registration, and logs immutable audit trail (`ATTENDEE_REGISTERED`).
       - `getMyRegistration(eventId, userSupabaseId)`: Retrieves active registration and linked credential.
       - `cancelRegistration(eventId, userSupabaseId, reason)`: Marks registration as `CANCELLED`, atomically revokes linked credential (`status: 'REVOKED'`), and writes audit entry (`ATTENDEE_CANCELLED`).
       - `getMyWallet(userSupabaseId)`: Queries all registrations across events, joins event metadata, and includes credentials issued via CSV bulk imports by user's email.
  3. **Attendee Hackathon Teaming Workflows**:
     - Extended `EventTeamService` and `MongoEventTeamRepository` with attendee-facing operations:
       - `getMyTeam(eventId, callerSupabaseId)`: Finds attendee's team via `findByMemberEmail`.
       - `createAttendeeTeam(eventId, callerSupabaseId, teamName, track)`: Attendee forms a team and becomes Team Lead.
       - `joinAttendeeTeam(eventId, callerSupabaseId, teamName)`: Attendee joins an existing open team within roster limits (max 6).
       - `submitAttendeeProject(eventId, callerSupabaseId, projectData)`: Updates project title, description, repo URL, demo URL, and sets status to `SUBMITTED`.
  4. **REST Routes & Controller**:
     - Mounted event-scoped endpoints in `event-registration.routes.ts`: `POST /register`, `GET /my-registration`, `DELETE /my-registration`, `GET /my-team`, `POST /my-team`, `POST /my-team/join`, `PUT /my-team/submit`.
     - Mounted global `/api/attendee/wallet` on `attendee.routes.ts` in `server/src/app.ts`.
  5. **Frontend UI & Visual Experience**:
     - Built `client/src/api/attendee.ts` client wrapper.
     - Built `client/src/components/events/EventRegistrationModal.tsx` for 1-click self-registration with event-type aware questionnaires.
     - Built `client/src/pages/AttendeeWalletPage.tsx` adhering to Obsidian/Emerald styling (`#090d16` canvas, `#111622` card containers, `#10b981` accents):
       - Pass cards with status pills, formatted IDs, event meta, and direct PNG download.
       - High-contrast dynamic QR code modal powered by `qrcode`.
       - Hackathon Teaming & Submission hub.
       - Integrated "My Wallet" into `Header.tsx` and mounted `/wallet` route in `App.tsx`.
- **Consequences**:
  - Full end-to-end self-service attendee lifecycle from registration to gate entry.
  - Zero-Trust attendee scoping prevents cross-user credential inspection (IDOR-safe).
  - Clean builds on client and server.

---

## ADR-035: Interactive Public Platform & Trust Governance (Phase 21)
- **Status**: ACCEPTED
- **Context**:
  1. Ticketification required a publicly accessible layer enabling external attendees and visitors to discover events, browse schedules, view verified host profiles, and register without needing advance administrative invitations.
  2. The public surface must maintain strict Zero-Trust boundaries: unverified or internal lifecycle states (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `SUSPENDED`, `CANCELLED`) and organizer PII (passwords, internal tokens, contact phone numbers) must never leak.
  3. Trust & safety reporting channels were required so that attendees and visitors could flag fraudulent events, scams, impersonations, or misleading venue listings.
- **Decision**:
  1. **Strict Lifecycle Isolation on Public Queries**:
     - Enforced `status: { $in: ['PUBLISHED', 'REGISTRATION_OPEN', 'EVENT_LIVE'] }` on all public queries in `MongoEventRepository.findPublicEvents` and `findPublicById`.
     - Non-public events return `404 Not Found` immediately, preventing IDOR leaks.
  2. **Sanitized Host Trust Profiles**:
     - Public organizer responses only expose verified public profile attributes (`name`, `organizationName`, `institutionType`, `institutionName`, `bio`, `website`, `logoUrl`, `hostVerificationStatus`).
     - Internal IDs, authentication UIDs, and personal contact info are strictly omitted.
  3. **Trust & Safety Reporting Engine**:
     - Created `EventReportModel` (`server/src/db/mongo/models/event-report.model.ts`) with `timestamps: true` and `bufferCommands: false`.
     - Added `'EVENT_REPORTED'` to immutable `AuditAction` enum.
     - Created `MongoEventReportRepository` and wired up report persistence with audit log entries for platform administrators.
  4. **Layered Public Architecture**:
     - Built `PublicEventService` (`server/src/modules/events/services/public-event.service.ts`) with live capacity calculation, event discovery, host profiles, and report handling.
     - Built `PublicEventController` and mounted `publicEventRouter` at `/api/public` in `server/src/app.ts`.
  5. **Frontend Experience & Landing Microsites**:
     - Created `client/src/api/public.ts` client wrapper.
     - Built `client/src/pages/PublicEventsPage.tsx` (`/explore`): Hero discovery banner, debounced search, category filter pills (`Hackathon`, `Conference`, `Concert`, `Festival`, `Workshop`, `College Event`), format and pricing filters, Obsidian/Emerald event cards.
     - Built `client/src/pages/PublicEventDetailPage.tsx` (`/events/:eventId/public`): Standalone landing microsite with countdown clock, agenda details, verified institutional trust badge, live capacity meter, 1-click registration pass trigger, and abuse reporting modal (`ReportEventModal.tsx`).
     - Added "Explore" navigation item in `Header.tsx` and configured accessible public routes in `App.tsx`.
- **Consequences**:
  - The Ticketification platform is now 100% complete across all 22 planned phases (Phases 0 through 21).
  - Visitors have a seamless, high-contrast discovery portal and event landing pages.
  - Zero-Trust security and host privacy are strictly enforced.
  - All 34 test suites pass with zero regressions.

---

## ADR-036: Background Job Reliability, Atomic Capacity Reservation & Bounded Export Streaming
- **Status**: ACCEPTED
- **Context**:
  1. Background job processing was previously dispatched in-memory via `setImmediate()`. Unhandled crashes, restarts, or multi-worker deployments risked losing queued jobs, executing duplicate jobs, or hanging jobs indefinitely without recovery.
  2. Bulk credential rendering had arbitrary pagination limits (500 and 200 records) which prevented processing large rosters beyond 500 attendees.
  3. Registration capacity checking used a race-prone read-then-write pattern (`countDocuments` followed by `create`), permitting over-registration under concurrent load. Duplicate active registrations were possible under simultaneous submissions.
  4. Event registration lifecycle lacked centralized state enforcement, permitting registrations on draft or suspended events if endpoints were directly called.
  5. Bulk export creation accumulated unrendered in-memory chunks (`chunks.push(chunk)` + `Buffer.concat()`), triggering V8 heap exhaustion on 512MB RAM containers.
- **Decision**:
  1. **Durable Worker Leases & Distributed Job Queue**:
     - Extended `event_jobs` schema with `lockedBy`, `lockExpiresAt` (5 min default lease), `attempts`, `maxAttempts` (default 3), `lastAttemptAt`, `failureReason`, and `nextRunAt`.
     - Added compound index `{ status: 1, lockExpiresAt: 1, nextRunAt: 1, createdAt: 1 }`.
     - Implemented atomic claiming via `claimJob` using `findOneAndUpdate({ _id, status: { $in: ['QUEUED', 'PROCESSING'] }, $or: [{ lockedBy: null }, { lockExpiresAt: { $lt: new Date() } }] }, { $set: { status: 'PROCESSING', lockedBy: workerId, lockExpiresAt } })`.
     - Added bounded retries with exponential backoff (`releaseJobForRetry`), server restart recovery (`recoverAbandonedJobs`), and strict error sanitization (`sanitizeErrorMessage` redacting auth tokens, connection strings, keys, and PII).
     - Ensured idempotent side-effect resumption on import retry via `alreadyCreatedCount` offset.
  2. **Cursor-Based Bulk Rendering Beyond 500 Records**:
     - Replaced arbitrary 200/500 query caps with `countUnrenderedByEvent` and cursor pagination `findUnrenderedBatch(eventId, limit, lastId)` querying `{ _id: { $gt: lastId } }`.
     - Renders pass batches until unrendered count reaches zero, guaranteeing support for large-scale attendee rosters under 512MB RAM constraints (`sharp.concurrency(1)`).
  3. **Atomic Database-Level Capacity Reservation & Partial Unique Indexing**:
     - Added `confirmedCount` field to `IEventRegistration` on `EventModel`.
     - Implemented `reserveRegistrationSlot(eventId, capacity)` executing atomic conditional increment: `findOneAndUpdate({ _id: eventId, $expr: { $lt: ['$registration.confirmedCount', '$registration.capacity'] } }, { $inc: { 'registration.confirmedCount': 1 } })`.
     - Automatic slot release (`releaseRegistrationSlot`) and credential revocation if subsequent registration steps fail.
     - Enforced partial unique compound indexes on `event_registrations`: `{ eventId: 1, userId: 1 }` and `{ eventId: 1, 'attendeeDetails.email': 1 }` filtered for active statuses (`CONFIRMED`, `WAITLISTED`, `ATTENDED`).
  4. **Centralized Registration Eligibility Validation**:
     - Enforced `validateRegistrationEligibility(event)` checking active event statuses (`PUBLISHED`, `REGISTRATION_OPEN`), valid registration windows (`registrationStartDate` / `registrationEndDate`), attendance mode matching, and `registrationRequired` configuration.
  5. **Streaming ZIP Archiver to Temporary File**:
     - Piped archiver directly to a temporary file via `fs.createWriteStream(tempFilePath)` in `os.tmpdir()`.
     - Streamed file to Supabase Storage via `fs.createReadStream(tempFilePath)` with error listeners and guaranteed cleanup (`fs.unlinkSync`) in `finally`.
- **Consequences**:
  - Background jobs are durable, resilient across server crashes and multi-instance concurrency.
  - Zero capacity overselling under high concurrency.
  - Constant bounded memory usage for bulk exports.
  - 100% compliance with engineering rules and zero external queue dependencies (Redis-free).

---

## ADR-037: Secure Private Ticket Downloads & Atomic Registration Capacity Reconciliation
- **Status**: ACCEPTED
- **Context**:
  1. Private ticket downloads previously risked falling back to public URLs on signed URL creation failures, and client-side downloads triggered cross-origin browser tab openings due to browser security restrictions on the HTML5 `download` attribute across origins.
  2. Registration capacity checking risked race conditions during reconciliation where a background or lazy counter sync could read a count and blindly overwrite a counter incremented by an in-flight concurrent reservation.
  3. Legacy events lacked reliable `confirmedCount` tracking or had inconsistent counters (e.g. 0 despite existing active registrations).
- **Decision**:
  1. **Strictly Private Storage & Presigned Downloads**:
     - Configured Supabase Storage buckets as private (`public: false`).
     - Removed all fallbacks to `getPublicUrl()` on signed URL failure; throws typed `StorageError`.
     - Attached `Content-Disposition: attachment; filename="<CanonicalFileName>"` via `{ download: fileName }` in `createSignedUrl` with 900-second (15-minute) expiry.
     - Frontend ticket download fetches authenticated blobs and triggers same-origin Blob URL downloads.
  2. **Authoritative Status Definition for Capacity**:
     - Exported and enforced `CONFIRMED_CAPACITY_STATUSES = ['CONFIRMED', 'ATTENDED'] as const`.
     - Waitlist (`WAITLISTED`) and cancelled (`CANCELLED`) records do not consume confirmed capacity slots.
  3. **Compare-And-Swap (CAS) Versioned Reconciliation**:
     - Added `reconcileVersion` and `reconciledAt` to `IEventRegistration`.
     - In `reconcileConfirmedCount`, used bounded CAS retry logic: `updateOne({ _id: eventId, 'registration.reconcileVersion': version }, { $set: { 'registration.confirmedCount': actualCount, 'registration.reconciledAt': now }, $inc: { 'registration.reconcileVersion': 1 } })`.
     - If a concurrent reservation or release alters `reconcileVersion` during counting, the CAS update matches 0 documents and yields or retries, guaranteeing that concurrent reservations are NEVER overwritten by a stale count.
     - Once `reconciledAt` is set, reservations take an O(1) indexed path without performing full collection scans.
  4. **Idempotent Slot Release**:
     - Added `releasedTokens` bounded array (`$slice: -100`) to track recently released reservation/registration tokens.
     - In `releaseRegistrationSlot`, conditioned update on `'registration.releasedTokens': { $ne: releaseToken }`, guaranteeing that multiple cancellation or rollback calls cannot double-decrement capacity.
  5. **Atomic Conditional Capacity Reservation**:
     - Conditional `findOneAndUpdate` using `$expr: { $lt: [{ $ifNull: ['$registration.confirmedCount', 0] }, capacity] }` and `$inc: { 'registration.confirmedCount': 1, 'registration.reconcileVersion': 1 }`.
     - Failures during credential issuance or registration persistence safely trigger idempotent rollback and credential revocation.
- **Consequences**:
  1. Zero binary payloads routed through Node heap during direct downloads, with zero sensitive tokens logged.
  2. Capacity limits are mathematically guaranteed under high concurrency (e.g., exactly 1 winner when 1 slot remains).
  3. Reconciliation is safe against concurrent reservations, repeatable, and bounded.

---

## ADR-038: Bulk Ticket Rendering Reliability & Terminal Job State Invariants
- **Status**: ACCEPTED
- **Context**:
  1. Bulk credential rendering jobs previously risked reporting full `COMPLETED` success when individual credentials failed during rendering or storage upload, leaving required passes unrendered while showing misleading 100% completion to hosts.
  2. Temporary process crashes between storage upload and progress persistence could cause redundant re-rendering or orphaned assets on retry.
  3. Stale workers whose lease expired could theoretically overwrite active progress or complete jobs they no longer owned.
  4. Fabricated legacy date fallbacks (`2026-10-10`) were hardcoded in several paths, showing incorrect dates on passes when event schedule date was missing.
- **Decision**:
  1. **Strict Accounting & No False Completion**:
     - Jobs are NEVER marked `COMPLETED` while any credential remains unrendered (`finalRemaining > 0` or unhandled failures).
     - Individual credential rendering errors are recorded in `result.errorLog` with identifier and sanitized error.
     - When unrendered tickets remain at the end of a pass: if attempts < maxAttempts, the job is released back to `QUEUED` with bounded backoff for retry; if attempts >= maxAttempts, it transitions to `FAILED`.
  2. **Bounded Non-Redundant Retries**:
     - During retries, `findUnrenderedBatch` query (`asset.storagePath: { $in: [null, ''] }`) and in-loop filter immediately skip already rendered credentials. Succeeded credentials from prior attempts are preserved and NEVER regenerated.
     - Storage paths follow the canonical deterministic schema `events/{eventId}/credentials/{credentialId}.png`, ensuring idempotent overwrites without duplicate storage objects.
  3. **Strict Worker Lease Governance**:
     - `updateProgress`, `markCompleted`, and `markFailed` enforce `lockedBy: workerId` AND `lockExpiresAt: { $gte: now }`. Stale workers whose leases expired or were reassigned are rejected, protecting active jobs from corrupted progress.
  4. **Authentic Event Date Resolution**:
     - Removed all instances of the fabricated `2026-10-10` fallback.
     - Event dates resolve strictly from `schedule.startAt` (formatted via `toLocaleDateString()`), falling back safely to `'Date TBA'` when undefined or invalid.
- **Consequences**:
  1. Every required ticket is reliably rendered or explicitly reported as failed; zero silent omissions.
  2. Retries are idempotent, fast, and consume minimal resources by processing only outstanding unrendered records.
  3. Stale worker split-brain conditions are strictly prevented.

---

## ADR-039: Bounded-Memory Keyset ZIP Export, Cursor Streaming & Safe Error Cleanup (Fix 4)
- **Status**: ACCEPTED
- **Context**:
  1. Exporting passes for medium-to-large events via synchronous endpoints or unbounded memory buffering creates serious container crash risks on platforms like Render with 512MB RAM constraints.
  2. In-memory ZIP packaging (`archiver.pipe(res)` without backpressure or buffering entire datasets into memory) quickly exhausts V8 heap.
  3. Offset pagination (`skip`) suffers from O(N) database degradation on large collections and produces duplicate or skipped passes if records are inserted or updated concurrently.
  4. Transient errors during archive creation could leave incomplete or empty ZIP archives in storage with misleading `COMPLETED` job statuses, or leave orphaned temporary files on container disks.
- **Decision**:
  1. **Keyset Pagination on Monotonic Sequence Numbers**:
     - Both background job processing (`findExportCursor` in `MongoEventCredentialRepository`) and streaming HTTP endpoints (`findExportBatchKeyset` in `TicketRepository` / `TicketService.streamTicketsZip`) paginate strictly via `{ sequenceNumber: { $gt: lastSequenceNumber } }` sorted by `{ sequenceNumber: 1 }` with `limit: 50`.
     - Completely eliminates `skip` degradation and guarantees strict monotonic traversal without duplicates or missed records.
  2. **Bounded-Memory Cursor Streaming**:
     - Pass packaging iterates incrementally over the cursor with bounded concurrency. At no point is an array exceeding 50 records materialized in Node.js memory.
     - Memory assertions verify heap remains flat and bounded (< 30MB growth) across 50,000+ synthetic records.
  3. **Direct Disk Streaming with Backpressure Management**:
     - Background ZIP generation pipes `archiver` directly into a temporary file stream in `os.tmpdir()` (`fs.createWriteStream`).
     - Backpressure is explicitly respected: inspects `writeStream.writableNeedDrain` after each archive append and awaits `stream.once('drain')` before pulling next passes.
  4. **Strict Atomic Completion & Incomplete Archive Prevention**:
     - Archives are verified for minimum valid ZIP file size (> 22 bytes for empty zip, > 0 bytes exported).
     - If any ticket cannot be packaged or rendered, or if cursor iteration fails mid-export, `archive.abort()` is called immediately, the job transitions to `FAILED` with detailed errors in `result.errorLog`, and the incomplete archive is discarded. Never mark an incomplete archive `COMPLETED`.
  5. **Guaranteed Temporary File Cleanup**:
     - All temporary disk files are unlinked in `finally` blocks using `fs.promises.unlink()`, ensuring zero disk leaks regardless of success, failure, worker lease expiration, or external job cancellation.
- **Consequences**:
  1. Memory footprint during ZIP export remains strictly bounded to O(1) regardless of event size (100 or 50,000 passes).
  2. Zero orphaned temporary files left on disk after exports.
  3. Safe and verified ZIP output on all successful exports.

---

## ADR-040: Idempotent Bulk Attendee Import, Reusable Sequence Allocation & Deduplication (Fix 5)
- **Status**: ACCEPTED
- **Context**:
  1. Importing attendee rosters from large spreadsheets into `event_credentials` requires chunked execution to prevent memory spikes and timeouts.
  2. Workers may fail or be terminated midway through processing a chunk or during a lease expiration. If sequence allocations are re-calculated on every attempt, sequence numbering creates large numbering gaps or sequence counters drift forward uncontrollably.
  3. When an import job is retried or re-processed, naive inserts will either throw duplicate key errors on `{ eventId: 1, sequenceNumber: 1 }` or duplicate records, while naive overwrites could wipe out already active credentials, custom attendee details, or verification tokens.
  4. Source files often contain duplicate rows or duplicate email addresses that must be filtered out idempotently without failing the entire batch or double-counting imported records.
- **Decision**:
  1. **Reusable Monotonic Sequence Reservation**:
     - During the first attempt of an `IMPORT_CREDENTIALS` job, `startingSequence` is atomically allocated via `allocateSequenceBlock(eventId, count)` and persisted directly into `job.payload.startingSequence` and `job.payload.endSequence`.
     - On any subsequent attempt or worker retry, the job inspects `job.payload.startingSequence`. If already present, it REUSES the exact same sequence block and NEVER calls `allocateSequenceBlock` again. This prevents sequence number drift and guarantees gap-free, deterministic numbering across crashes and retries.
  2. **Idempotent Chunk Processing via `$setOnInsert` Semantics**:
     - Bulk credential persistence executes with `$setOnInsert` behavior matching `{ eventId, sequenceNumber }`.
     - If a credential for a given sequence was already committed before a worker crash, it is detected and preserved. Sensitive fields such as `verificationToken` and existing holder data are untouched.
     - Succeeded count strictly reflects actually created or already active credentials for the chunk, eliminating duplicate counting.
  3. **In-File and Cross-Chunk Deduplication**:
     - The parser and worker maintain an in-memory normalized email lookup (`Set<string>`) to immediately flag duplicate rows within the source file.
     - Duplicate rows are skipped, incrementing `skippedCount` and adding a clear explanation to `result.errorLog` (`"Duplicate email <email> in source file (skipped)"`).
     - Error logs are deduplicated across chunk iterations and retries to avoid duplicate error entries for the same row.
  4. **Strict Atomic Completion & Lease Validation**:
     - Every progress update and status finalization checks `lockedBy === workerId` and valid lease expiry.
     - Final `importedCount`, `skippedCount`, and `failedCount` reflect the aggregate ground truth across the entire sequence block, verified against database reality.
- **Consequences**:
  1. Full crash-resilience: an import job interrupted at any point can be re-run safely with 0 duplicate credentials, 0 sequence numbering gaps, and 0 duplicate key crashes.
  2. In-file duplicate rows are cleanly handled and logged without failing valid rows.
  3. Memory consumption remains strictly bounded during large spreadsheet ingestion.


