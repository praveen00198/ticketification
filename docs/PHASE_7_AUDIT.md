# Phase 7 Audit & Implementation Plan — Event Membership & Granular RBAC

## 1. Executive Summary
Phase 7 implements **Event Membership & Granular Role-Based Access Control (RBAC)**. In Ticketification, user identity is global (`users` collection in MongoDB + Supabase Auth), but operational roles (`HOST`, `COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR`) are strictly **event-scoped** relationships stored in `event_members`. A user who is a Host in Event A is a regular User in Event B.

---

## 2. Architectural Boundaries & Invariants

1. **No Duplicate Identity Systems**:
   - Users are never duplicated across role tables. There is ONE global user document per person in `users`.
   - Event roles are relationships stored in `event_members` binding `eventId` and `userId`.
2. **Zero-Trust Backend Enforcement**:
   - Roles and permissions must NEVER be read from frontend requests or local storage.
   - Backend middleware (`requireEventPermission`) evaluates caller permissions on every request by querying MongoDB `event_members`.
   - The event owner automatically possesses all permissions.
3. **Cryptographically Secure Invitations**:
   - Invitations use a 64-character cryptographic token (`crypto.randomBytes(32).toString('hex')`) with a 72-hour TTL.
   - Password generation via email is strictly forbidden. New users authenticate via Supabase Auth before accepting.
4. **Granular Permission Delegation**:
   - Specific permissions can be customized per role. For example, a `VOLUNTEER` does not receive `SCAN_CREDENTIALS` by default unless explicitly granted by the Host.
5. **Least Privilege**:
   - Evaluators cannot access finances or staff; Mentors cannot access judging scorecards; Volunteers cannot modify event settings.

---

## 3. Data Model Specification (`event_members`)

```typescript
export type EventRole = 'HOST' | 'COORDINATOR' | 'VOLUNTEER' | 'MENTOR' | 'EVALUATOR';

export type EventPermission =
  | 'MANAGE_EVENT_SETTINGS'
  | 'MANAGE_STAFF'
  | 'MANAGE_ATTENDEES'
  | 'IMPORT_ATTENDEES'
  | 'CONFIGURE_CREDENTIALS'
  | 'GENERATE_CREDENTIALS'
  | 'DOWNLOAD_CREDENTIALS'
  | 'SCAN_CREDENTIALS'
  | 'VIEW_ASSIGNED_TASKS'
  | 'UPDATE_ASSIGNED_TASKS'
  | 'MENTOR_ASSIGNED_TEAMS'
  | 'SCORE_ASSIGNED_TEAMS'
  | 'VIEW_EVALUATION_RESULTS'
  | 'EXPORT_EVENT_DATA';

export interface IEventMember {
  eventId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userEmail: string;
  role: EventRole;
  permissions: EventPermission[];
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  invitationToken?: string;
  invitationExpiresAt?: Date;
  invitedBy: mongoose.Types.ObjectId;
  acceptedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

## 4. Default Permissions Matrix

| Permission | HOST | COORDINATOR | VOLUNTEER | MENTOR | EVALUATOR |
|---|:---:|:---:|:---:|:---:|:---:|
| `MANAGE_EVENT_SETTINGS` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MANAGE_STAFF` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MANAGE_ATTENDEES` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `IMPORT_ATTENDEES` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `CONFIGURE_CREDENTIALS` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GENERATE_CREDENTIALS` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `DOWNLOAD_CREDENTIALS` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `SCAN_CREDENTIALS` | ✅ | ✅ | Optional (Toggle) | ❌ | ❌ |
| `VIEW_ASSIGNED_TASKS` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `UPDATE_ASSIGNED_TASKS` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `MENTOR_ASSIGNED_TEAMS` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `SCORE_ASSIGNED_TEAMS` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `VIEW_EVALUATION_RESULTS`| ✅ | ❌ | ❌ | ❌ | ✅ (Blind) |
| `EXPORT_EVENT_DATA` | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 5. Implementation Roadmap

1. **Model Layer**:
   - `server/src/db/mongo/models/event-member.model.ts` with compound indexes on `{ eventId: 1, userId: 1 }` and `{ invitationToken: 1 }`.
2. **Repository Layer**:
   - `server/src/modules/events/repositories/mongo-event-member.repository.ts`.
3. **Middleware Layer**:
   - `server/src/middlewares/rbac.middleware.ts` (`requireEventPermission`).
4. **Service Layer**:
   - `server/src/modules/events/services/event-member.service.ts` (invite, accept, update, revoke, list).
5. **Controller & Route Layer**:
   - `server/src/modules/events/controllers/event-member.controller.ts`.
   - `server/src/modules/events/routes/event-member.routes.ts`.
   - Mount in `server/src/modules/events/routes/event.routes.ts` and `server/src/app.ts`.
6. **Testing**:
   - `server/tests/eventMemberRbac.test.ts` (invitation token TTL, role scoping, permission checks, IDOR defenses).
7. **Frontend UI**:
   - `client/src/api/events.ts` (member endpoints).
   - `client/src/components/events/EventStaffCard.tsx` (staff management surface).
   - Mount in `client/src/pages/EventDetailPage.tsx`.
8. **Documentation**:
   - Record ADR-021 in `DECISION.md`.
   - Update `PHASES.md`.
