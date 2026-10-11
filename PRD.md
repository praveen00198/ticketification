# PRD.md — Product Requirements Document

## 1. Product Overview & Vision
**Product Name**: Ticketification  
**Platform**: Event Operating + Credential + Access Platform  
**Target Direction**: Ticketification is evolving from a single-purpose ticket generation tool into a comprehensive **Event Operating, Credential, and Access Platform**. It empowers event hosts to plan, configure, and operate diverse gatherings, manage attendee lifecycles, administer event staff and specialized roles, issue tamper-proof event credentials with dynamic QR codes, facilitate fair competitions and evaluations, and enforce high-throughput, atomic day-of-event access control.

The platform is explicitly **event-type aware** and avoids forcing every gathering into a rigid corporate or concert model. Supported event types include:
- College Festivals & University Cultural Meets
- Hackathons & Technical Competitions
- Workshops & Hands-on Bootcamps
- Academic & Professional Conferences
- Seminars & Panel Discussions
- Concerts & Live Performances
- Sports Meets & Tournaments
- Award Ceremonies & Galas
- Commercial Expos & Trade Fairs
- Corporate Gatherings & Offsites
- Private Events, Weddings & Celebrations
- Other custom organized gatherings

---

## 2. Customer-Facing Surfaces & Architectural Layers

```
                               ┌────────────────────────────────────────────────────────┐
                               │                 TICKETIFICATION PLATFORM               │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
             ┌──────────────────────────────┬──────────────┴───────────────┬──────────────────────────────┐
             ▼                              ▼                              ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐            ┌─────────────────┐            ┌───────────────────┐
    │     PUBLIC      │           │      HOST       │            │    ATTENDEE     │            │  PLATFORM ADMIN   │
    │ (Discovery &    │           │ (Organizer Ops  │            │ (Self-service   │            │ (Trust, Safety &  │
    │  Public Landing)│           │  & Management)  │            │  Portal - Future│            │  Platform Control)│
    └─────────────────┘           └─────────────────┘            └─────────────────┘            └───────────────────┘
```

### 2.1 Public Surface
- **Status**: Functional & Simple (Current); Interactive Public Platform (Future Phase 21).
- **Current Scope**: Minimal event landing page, public credential verification portal (`/verify/:token`), basic trust signals, report event modal.
- **Future Scope**: Rich event discovery, search & filtering, organizer public profiles, public schedule/speaker directories, direct attendee registration checkout.
- **Guideline**: Do not over-engineer the public surface during the current host-focused phase.

### 2.2 Host Surface (Primary Product Focus)
- **Status**: Current Primary Focus (Phases 1–19).
- **Target Persona**: Event organizers, campus club leads, conference chairs, hackathon leads, production managers.
- **Core Capabilities**:
  - Event creation with event-type detection and credential taxonomy selection.
  - Institutional and event verification submission.
  - Lifecycle management (`DRAFT` → `SUBMITTED` → `APPROVED` → `PUBLISHED` → `EVENT_LIVE` → `COMPLETED`).
  - Dual registration mode configuration (Ticketification native registration vs. existing attendee data import).
  - Staff onboarding via secure email tokens (Coordinators, Volunteers, Mentors, Evaluators).
  - Fine-grained permission assignments (e.g. assigning credential scanning rights to select volunteers).
  - Team creation and management for hackathons/competitions.
  - Evaluation criteria configuration, judging assignments, real-time scorecards, and ranking exports.
  - Credential template management and dynamic layout binding.
  - Asynchronous background jobs for bulk credential generation (10,000–20,000 attendees) and ZIP exports.
  - Day-of-event mobile QR verification console with real-time operational feeds.
  - Event health analytics, capacity monitors, and audit trail inspection.

### 2.3 Attendee Surface (Future Architecture)
- **Status**: Architecture Ready; Implementation Deferred (Phase 20).
- **Design Rule**: All database models, authorization rules, and identity relationships must accommodate the attendee self-service portal without requiring an architectural rewrite.
- **Future Capabilities**: Personal credential wallet, registration history, team formation and submission dashboard, mentor session booking, live event announcements, and direct payment tracking.

### 2.4 Internal Platform Admin Surface
- **Status**: Administrative Governance Layer.
- **Purpose**: Internal operations, trust, safety, and regulatory compliance. Distinct from event hosts.
- **Core Capabilities**:
  - Host identity verification and institution validation.
  - Review and approval of paid events before ticketing activates.
  - Moderation of reported events (scams, impersonation, policy violations).
  - Emergency event and host suspension with immediate operational circuit breakers.
  - Dispute management, payment audit logging, and platform-wide telemetry.

---

## 3. Core Identity & Authorization Model

### 3.1 One Global User Identity
A critical architectural foundation of Ticketification is that **a single human has exactly one global user account**. Users are NOT divided into siloed tables (`hosts`, `attendees`, `volunteers`, `evaluators`).

```
                    ┌───────────────────────────────────────────────┐
                    │            GLOBAL USER: Rahul Sharma          │
                    │  (Supabase Auth UID + MongoDB Profile Record) │
                    └───────────────────────┬───────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
  [Event A: TechFest]  [Event B: Hackathon]           [Event C: Summit]   [Event D: Concert]
  Role: HOST           Role: EVALUATOR                Role: VOLUNTEER     Role: ATTENDEE
  Permissions: Full    Permissions: [SCORE_ASSIGNED]  Permissions: [SCAN] Permissions: [VIEW]
```

### 3.2 Authentication vs. Authorization Boundary
- **Authentication ("Who are you?")**: Exclusively managed by **Supabase Auth**. Issues cryptographically signed JWTs.
- **Application Profile & Authorization ("What can you do?")**: Exclusively managed by the **Backend Application & MongoDB**.
- **Critical Security Invariant**: Being authenticated through Supabase Auth grants ZERO default administrative or host privileges. A regular authenticated user starts with platform role `USER` and has zero access to platform administration or unauthorized events.

### 3.3 Platform Roles vs. Event-Scoped Roles
1. **Platform Roles**:
   - `USER`: Standard global user. Can create events (subject to verification), attend events, or accept staff invitations.
   - `ADMIN`: Ticketification platform operator. Can review events, verify hosts, and moderate reports.
   - `SUPER_ADMIN`: Root platform administrator with emergency override and configuration access.
2. **Event-Scoped Roles (via `event_members`)**:
   - `HOST`: Event owner/creator. Full management of the specific event.
   - `COORDINATOR`: Delegated operational lead (e.g. manages volunteers and logistics). Cannot delete event or modify billing.
   - `VOLUNTEER`: Field staff. Receives task-specific permissions (e.g. `SCAN_CREDENTIALS`, `VIEW_ASSIGNED_TASKS`).
   - `MENTOR`: Hackathon/workshop advisor. Isolated access to assigned teams and ideas.
   - `EVALUATOR`: Competition judge. Isolated workspace for assigned teams and scoring criteria.

---

## 4. Credential Taxonomy & Event-Type Awareness

### 4.1 Generic Credential Abstraction
Internally, the system treats all passes, tickets, and badges as an **Event Credential**. The customer-facing term dynamically adapts to the event type, with optional host customization:

| Event Type | Default Customer-Facing Credential Term | Staff / Special Badges |
|---|---|---|
| **Concert / Music Show** | Ticket | VIP Pass, Crew Pass, Backstage Pass |
| **Hackathon** | Participant Pass | Mentor Pass, Judge Pass, Organizer Pass |
| **Conference / Summit** | Attendee Pass | Speaker Pass, Delegate Pass, VIP Pass |
| **College Fest** | Event Pass | Coordinator Pass, Volunteer Pass, Guest Pass |
| **Workshop / Bootcamp**| Workshop Pass | Instructor Pass, Assistant Pass |
| **Sports Event** | Entry Pass | Player Pass, Official Pass, Referee Pass |
| **Competition** | Contestant Pass | Evaluator Pass, Marshall Pass |
| **Award Ceremony** | Guest Pass | Nominee Pass, VIP Pass, Media Pass |
| **Expo / Trade Fair** | Visitor Pass | Exhibitor Pass, Buyer Pass, Staff Pass |
| **Corporate Event** | Access Pass | Executive Pass, Staff Pass |
| **Wedding / Private** | Invitation / Entry Pass | Family Pass, VIP Guest |

---

## 5. Event Lifecycle & Verification

### 5.1 Event Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Host creates event
    DRAFT --> SUBMITTED : Host submits for review
    SUBMITTED --> UNDER_REVIEW : Platform Admin picks up
    UNDER_REVIEW --> APPROVED : Verification checks pass
    UNDER_REVIEW --> REJECTED : Insufficient proof / policy breach
    REJECTED --> DRAFT : Host fixes issues
    APPROVED --> PUBLISHED : Host publishes event
    PUBLISHED --> REGISTRATION_OPEN : Registration window starts
    REGISTRATION_OPEN --> REGISTRATION_CLOSED : Capacity reached / Deadline
    REGISTRATION_CLOSED --> EVENT_LIVE : Event date / Gate opens
    EVENT_LIVE --> COMPLETED : Event concludes
    COMPLETED --> ARCHIVED : Event records sealed
    
    UNDER_REVIEW --> SUSPENDED : Emergency safety flag
    PUBLISHED --> SUSPENDED : Abuse / Payment fraud reported
    EVENT_LIVE --> SUSPENDED : Policy violation
    PUBLISHED --> CANCELLED : Host cancels event
```

### 5.2 Verification Framework
To prevent ticket fraud, scam events, and unauthorized financial collections, events must undergo verification:
1. **Educational / Institution Verification**:
   - Host provides institution name, official domain email, department, designation, and official announcement/approval documentation.
   - Domain verification via OTP proves email ownership, but is **NOT** treated as sole authorization proof.
   - Platform Admin verifies institution authenticity against directory records.
2. **Risk-Based Verification Tiers**:
   - **Low Risk** (Free events, verified host, capacity < 200): Automated heuristics and expedited review.
   - **Medium Risk** (Free events, new host, capacity 200–2,000): Host identity check and venue confirmation.
   - **High Risk** (Paid events, large capacity > 2,000, high revenue): Mandatory manual review, bank/payout KYB, and official authorization document verification before tickets go on sale.

---

## 6. Registration Modes & Ingestion Pipelines

The event creation flow prompts:
1. *"What type of event are you hosting?"*
2. *"How will attendees receive their credentials?"*

### 6.1 Mode A: Ticketification Native Registration
Ticketification hosts the registration form and manages attendee checkout.
- **Free Events**: Dynamic form builder, registration capacity limits, automatic waitlist, instant credential issuance.
- **Paid Events**: Payment gateway integration (Razorpay/Stripe).
  - Payment confirmation **MUST** be driven by signature-verified, idempotent server webhooks.
  - The client route `/payment/success` is **NEVER** trusted as proof of payment.
  - Zero cardholder data stored on Ticketification servers.
- **Event-Type Aware Dynamic Forms**:
  - Hackathons: Team name, teammates, GitHub, LinkedIn, tech stack, track preference.
  - Conferences: Organization, job title, dietary requirements, breakout session selection.
  - Bootcamps: Skill level, laptop OS, prerequisites acknowledgement.

### 6.2 Mode B: Existing Attendee Data Import
For organizers who already gathered attendees via Excel, Google Forms, College Portals, or external ticketing.
- **Flow**: Host uploads file (`.xlsx`, `.xls`, `.csv`) directly to Supabase Storage via a presigned URL.
- **Worker Job**: An asynchronous background worker streams the file, identifies headers with confidence scoring, maps columns to internal schema, and runs validation.
- **No Paid/Free Confusion**: The system does NOT ask whether imported attendees paid; external payment is an external concern.
- **Capacity**: Supports 10,000–20,000 rows without blocking the web server.

### 6.3 Mode C: External Registration API (Future Architecture)
Webhook and REST ingestion endpoint allowing external websites and CRMs to stream registrations directly into Ticketification.

---

## 7. Staff Management & Granular RBAC

### 7.1 Secure Invitation Workflow
Hosts invite team members by entering an email and selecting a role.
- System generates a cryptographically random, single-use invitation token with a 72-hour TTL.
- System dispatches an invitation link: `https://APP_DOMAIN/invite/accept?token=<TOKEN>`.
- **Zero Generated Passwords via Email**: If the user is new, they complete password creation via Supabase Auth.
- Upon acceptance, an `event_members` record binds their global user ID to the event with assigned permissions.

### 7.2 Granular Event Permissions
Permissions are assigned per event membership, not globally:
- `COORDINATOR`: `MANAGE_VOLUNTEERS`, `ASSIGN_VOLUNTEER_TASKS`, `VIEW_ATTENDEE_LIST`. Cannot delete event, modify pricing, or alter evaluation criteria.
- `VOLUNTEER`: `VIEW_ASSIGNED_TASKS`, `UPDATE_TASK_STATUS`. Scanning permissions (`SCAN_CREDENTIALS`) are granted selectively by the Host.
- `MENTOR`: Restricted workspace displaying assigned teams, project title, problem statement, and repository links. No access to financial, credential generation, or judging data.
- `EVALUATOR`: Dedicated workspace displaying assigned teams, evaluation rubric, and scoring inputs. Blind evaluation prevents viewing scores from other evaluators until finalized.

---

## 8. Hackathon & Competition Modules

### 8.1 Team Management
- Event-scoped teams (`teams` and `team_members`).
- Team lead, member invitations, team limits, and project submission details (Repository URL, Demo Video, Deck).
- Strict event data isolation: teams cannot span across multiple events.

### 8.2 Evaluation & Scoring Engine
- **Configurable Rubrics**: Multi-criteria weighted scoring (e.g. Technical Feasibility 30%, Innovation 25%, Impact 25%, Presentation 20%).
- **Judging Workflow**:
  - `OPEN`: Evaluators submit scores for assigned teams.
  - `CLOSED`: Submissions locked; evaluators cannot modify scores.
  - `FINALIZED`: Scores verified and locked by Host.
- **Host Override**: Any administrative score adjustment requires an explicit reason and generates an immutable audit log entry.
- **Leaderboards & Exports**: Real-time ranking with filters (by category, college, track), custom top-N exports handled asynchronously.

---

## 9. Credential Generation & Verification Engine

### 9.1 Asset Storage Hierarchy
- **Metadata**: Stored in MongoDB (`credentials`).
- **File Binaries**: Stored exclusively in **Supabase Storage**. MongoDB NEVER stores binary images, PDFs, or ZIP archives.
- **Storage Path Hierarchy**:
  - Credentials: `/events/{eventId}/credentials/{credentialId}.png`
  - PDF Passes: `/events/{eventId}/credentials/{credentialId}.pdf`
  - Templates: `/events/{eventId}/templates/{templateId}.{ext}`
  - Bulk ZIP Exports: `/events/{eventId}/exports/{jobId}.zip`

### 9.2 High-Throughput QR Verification
- QR codes encode an opaque, signed verification token (`https://APP_DOMAIN/verify/<64_CHAR_TOKEN>`), NEVER raw attendee PII.
- **Atomic Single-Use Check-In**: High-concurrency gates execute conditional atomic updates:
  ```text
  Match: { _id: credentialId, status: "ACTIVE" }
  Update: { $set: { status: "CHECKED_IN", checkedInAt: new Date() } }
  ```
  If two scanners scan the same QR simultaneously, exactly one receives `SUCCESS`; the other receives `ALREADY_CHECKED_IN` with the prior timestamp.
- **Reusable Worker / Staff Passes**: Allowed multiple entries; each scan appends an entry to `credential_checkins`. Unassigned worker passes prompt for name assignment on first scan.

### 9.3 Asynchronous Job Queue for Bulk Operations
Bulk credential generation (10,000–20,000 items) and ZIP creation MUST NEVER execute synchronously within an HTTP request.
- Host triggers operation ➔ System responds immediately with `jobId` (`HTTP 202 Accepted`).
- Background worker processes records in bounded batches, uploads assets to Supabase Storage, and updates job progress (`0%` → `100%`).
- Client polls job status or receives progress events; completed jobs expose a presigned download URL.

---

## 10. Non-Functional & Operational Requirements

### 10.1 Security & Compliance
- **Zero-Trust Backend**: Backend is the sole security boundary. Frontend route guards are UX only.
- **IDOR Protection**: Every database query on event-scoped resources explicitly validates that the actor belongs to that event with required permissions.
- **Rate Limiting**: Distributed, endpoint-aware rate limiting protecting auth endpoints, QR scanner, and export triggers.
- **Audit Logging**: Immutable audit logs capturing actor, action, event ID, target entity, metadata, IP, and timestamp.

### 10.2 Performance on Resource-Constrained Hosting (Render 512MB RAM)
- Native image processing using `sharp` with `sharp.cache(false)` and `sharp.concurrency(1)`.
- Reusable background buffers pre-loaded in memory; SVG overlays composited via native C++ bindings.
- Bundled Devanagari/Hindi OpenType fonts (`assets/fonts/NotoSansDevanagari-Bold.ttf`) embedded as base64 in SVG templates to guarantee deterministic rendering.
- Bounded batch sizes (1–2 tickets per batch) with immediate buffer dereferencing to prevent V8/libvips memory leaks.

---

## 11. Scope Boundaries & Roadmap

### 11.1 Current Phase Scope (Phases 0–19)
- Architecture and documentation reconciliation.
- Authentication & MongoDB authorization foundation.
- Host onboarding and event creation workflows.
- Event verification and lifecycle management.
- Granular event RBAC (Coordinators, Volunteers, Mentors, Evaluators).
- Team and evaluation management.
- Credential generation, templates, and atomic QR check-in.
- Asynchronous bulk jobs (import, generation, export).
- Performance, security, and audit hardening.

### 11.2 Future Scope (Phases 20–21)
- Attendee self-service portal (Phase 20).
- Public interactive event discovery directory and social features (Phase 21).
- External registration webhook API.
- Native mobile scanner applications (iOS/Android) if web camera performance requires augmentation.
