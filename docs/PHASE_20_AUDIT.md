# Phase 20 Audit & Specification — Attendee Self-Service Platform

## 1. Executive Summary
Phase 20 transitions Ticketification from an administrative event host tool to a complete participant-facing platform. It delivers the **Attendee Self-Service Platform**, enabling authenticated attendees to register for events, claim tamper-proof visual credentials with dynamic QR codes, access a centralized personal credential wallet across multiple events, and form teams for hackathons and competitions.

---

## 2. Architecture & Invariants

### 2.1 One Global Identity Model
- Every participant has one global identity mapped to Supabase Auth (`supabaseId`) and MongoDB (`users`).
- Roles are event-scoped. An attendee in Event A can be an Evaluator in Event B and a Host in Event C.
- Registration records link an authenticated user's global identity to an event and an issued credential.

### 2.2 Core Invariants
1. **Idempotent Single Registration**: A user cannot have multiple active registrations for the same event (`{ eventId, userId }` unique index). Subsequent registration attempts return the existing active registration.
2. **Capacity Enforcement**: Registrations fail or enter waitlist if current active registrations exceed `event.registration.capacity`.
3. **Event State Guarding**: Users can only register for events in allowed states (`PUBLISHED`, `REGISTRATION_OPEN`, `EVENT_LIVE`). Suspended, cancelled, or archived events reject registrations with HTTP 400.
4. **Credential Auto-Issuance**: Successful self-registration automatically provisions an `EventCredential` with an atomic sequence number, 64-char crypto verification token, and `ACTIVE` status.
5. **Zero-Trust Wallet Boundary**: Attendee wallet endpoints (`GET /api/attendee/wallet`) strictly scope results to the caller's verified `userId` and `supabaseId`. No user can inspect another attendee's wallet (IDOR prevention).
6. **Cancellation & Revocation Cascading**: When an attendee cancels their registration, the linked `EventCredential` is atomically revoked (`status: 'REVOKED'`), preventing entrance turnstile check-in.

---

## 3. Data Schema: `event_registrations`

| Field | Type | Required | Description |
|---|---|---|---|
| `eventId` | ObjectId | Yes | Foreign reference to `events` collection. |
| `userId` | ObjectId | Yes | Foreign reference to `users` collection. |
| `userSupabaseId` | String | Yes | Foreign reference to Supabase Auth UUID. |
| `credentialId` | ObjectId | Yes | Foreign reference to issued `event_credentials`. |
| `status` | String | Yes | Enum: `CONFIRMED`, `WAITLISTED`, `CANCELLED`, `ATTENDED`. Default `CONFIRMED`. |
| `registrationType` | String | Yes | Taxonomy term (e.g., `ATTENDEE`, `HACKER`, `DELEGATE`). |
| `attendeeDetails` | Object | Yes | Snapshot of name, email, phone, organization, designation. |
| `responses` | Object | No | Dynamic custom responses (dietary, GitHub, track, etc.). |
| `teamId` | ObjectId | No | Optional reference to `event_teams` for hackathons. |
| `registeredAt` | Date | Yes | Timestamp of registration creation. |
| `cancelledAt` | Date | No | Timestamp of cancellation (if cancelled). |
| `cancellationReason`| String | No | Reason for cancellation. |

---

## 4. API Endpoints

### 4.1 Attendee Registration & Wallet
- `POST /api/events/:eventId/register`: Register authenticated user for an event and auto-issue credential.
- `GET /api/events/:eventId/my-registration`: Get current user's registration and credential for event.
- `DELETE /api/events/:eventId/my-registration`: Cancel registration and revoke credential.
- `GET /api/attendee/wallet`: Cross-event personal credential wallet listing all user passes.

### 4.2 Attendee Team Self-Service
- `GET /api/events/:eventId/my-team`: Get team details where attendee is leader or member.
- `POST /api/events/:eventId/my-team`: Attendee creates their own team (becomes leader).
- `POST /api/events/:eventId/my-team/join`: Attendee joins existing team.
- `PUT /api/events/:eventId/my-team/submit`: Attendee updates project title, repo URL, demo URL.

---

## 5. UI/UX Specifications
- **Attendee Wallet Page (`/wallet`)**:
  - Obsidian/Emerald visual theme (`#090d16` canvas, `#111622` card containers, `#10b981` accents).
  - Visual Pass Card: Interactive badge with glowing Emerald borders, QR inspection trigger, sequence ID badge, and direct PNG download.
  - Dynamic QR Code Modal: High-resolution QR display for gate check-in scanners.
  - Hackathon Teaming Card: Direct team status, teammate roster, and project submission inputs.
- **Event Registration Modal**:
  - Responsive modal opened from public event pages or event detail views.
  - Dynamically asks for relevant details based on event type.
