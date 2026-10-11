# Phase 12 Implementation Audit: Credential Architecture & Abstraction Engine

## 1. Executive Summary & Purpose
Ticketification serves diverse event types (Hackathons, Concerts, Conferences, College Fests, Sports Tournaments, Workshops). Historically, legacy systems forced every physical badge or entry pass into a rigid "ticket" model stored across fragmented tables.

**Phase 12: Credential Architecture** introduces the platform's canonical **Generic Credential Abstraction** in MongoDB (`event_credentials` collection):
1. **Event-Type Aware Taxonomy**: Dynamically maps credential labels (e.g. "Ticket", "Participant Pass", "Attendee Badge", "Workshop Pass", "VIP Pass", "Worker Pass") according to event classification.
2. **Monotonic Event Sequence Counters**: Guarantees deterministic, sequential, collision-free human-readable sequence IDs (e.g. `TIC-00001`, `PASS-00102`) per event via atomic sequence allocation.
3. **Opaque 64-Character Verification Tokens**: Every credential features a cryptographically secure 64-character hex token (`crypto.randomBytes(32).toString('hex')`) encoding zero PII.
4. **Holder Identity Isolation & Assignment**: Full support for assigned attendees, team links, as well as unassigned staff/volunteer passes that can be named on first check-in or distribution.
5. **Storage & Pre-signed Asset Pathway**: Establishes standard object storage keys (`events/${eventId}/credentials/${filename}.png`) ready for Phase 13 template rendering and Phase 14 atomic check-in.

---

## 2. Security Boundaries & Invariants
1. **Zero PII Exposure in Verification Tokens**:
   - The 64-character token URL contains zero attendee name, email, phone number, or internal database primary keys.
   - Public token lookup returns strictly sanitized, non-sensitive credential status and event metadata.
2. **Event Isolation (IDOR Prevention)**:
   - All management queries, single-credential lookups, and mutations verify `{ eventId, _id }`.
3. **Sequence Uniqueness**:
   - Compound unique index `{ eventId: 1, sequenceNumber: 1 }` guarantees no sequence duplication within any event.
4. **Token Uniqueness**:
   - Unique index `{ verificationToken: 1 }` prevents token collisions across the entire platform.
5. **Authorization Guards**:
   - Only `HOST` and `COORDINATOR` roles (evaluated via MongoDB `event_members`) can issue, modify, or revoke credentials.
6. **Immutable Audit Trail**:
   - Credential issuance, status transitions, and revocations write audit log entries.

---

## 3. Data Collections Schema

### `event_credentials` Collection
- `_id`: ObjectId
- `eventId`: ObjectId (required, indexed)
- `sequenceNumber`: number (required, compound unique with `eventId`)
- `formattedId`: string (e.g. `TIC-00001` or `HACK-00042`)
- `verificationToken`: string (64-character hex, unique: true, indexed)
- `credentialType`: string (e.g. `ATTENDEE`, `VIP`, `WORKER`, `SPEAKER`, `ORGANIZER`, `GUEST`, default: `ATTENDEE`)
- `terminology`: string (e.g. `Ticket`, `Participant Pass`, `Badge`, `Workshop Pass`)
- `usagePolicy`: `'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER'` (default: `'SINGLE_USE'`)
- `status`: `'ACTIVE' | 'CHECKED_IN' | 'REVOKED' | 'EXPIRED'` (default: `'ACTIVE'`, indexed)
- `holder`:
  - `name`: string (e.g. 'Rahul Sharma')
  - `email`: string | null
  - `phone`: string | null
  - `organization`: string | null
  - `designation`: string | null
  - `teamId`: ObjectId | null
  - `category`: string (e.g. 'VIP', 'General', 'Crew')
  - `isAssigned`: boolean (default: true; false for unassigned worker passes)
- `asset`:
  - `storagePath`: string | null (e.g. `events/${eventId}/credentials/${filename}.png`)
  - `publicUrl`: string | null
  - `renderedAt`: Date | null
  - `mimeType`: string (default: `'image/png'`)
- `metadata`: Record<string, any> (dynamic custom attributes, table allocation, dietary requirements)
- `createdBy`: ObjectId (user who issued)
- `revokedAt`: Date | null
- `revokedReason`: string | null
- `timestamps`: true (`createdAt`, `updatedAt`)

### Compound & Query Indexes:
- `{ eventId: 1, sequenceNumber: 1 }` (unique: true)
- `{ verificationToken: 1 }` (unique: true)
- `{ eventId: 1, status: 1 }`
- `{ eventId: 1, credentialType: 1 }`
- `{ eventId: 1, 'holder.email': 1 }`
- `{ eventId: 1, 'holder.teamId': 1 }`

---

## 4. Layered Architecture Implementation
1. **Model**:
   - `server/src/db/mongo/models/event-credential.model.ts`
2. **Repository**:
   - `server/src/modules/events/repositories/mongo-event-credential.repository.ts`
3. **Service**:
   - `server/src/modules/events/services/event-credential.service.ts`
4. **Controller**:
   - `server/src/modules/events/controllers/event-credential.controller.ts`
5. **Routes**:
   - `server/src/modules/events/routes/event-credential.routes.ts` (mounted under `/api/events/:eventId/credentials` and public `/api/credentials/verify-token/:token`)
6. **Frontend**:
   - API client methods in `client/src/api/events.ts`
   - Host management component: `client/src/components/events/EventCredentialManagerCard.tsx`
   - Mount in `client/src/pages/EventDetailPage.tsx`
