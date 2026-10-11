# Phase 10 Implementation Audit: Team Management Architecture

## 1. Executive Summary & Domain Scope
In hackathons, design sprints, case competitions, and group-based workshops, attendees operate primarily in cohorts or teams rather than as isolated individuals.
**Phase 10: Team Management** introduces the canonical `event_teams` MongoDB collection and corresponding layered backend services and frontend workspace to enable:
1. **Event-Scoped Team Lifecycle**: Registration, formation, project tracking, project submission (repo/demo links), table/booth assignment, and status transitions (`REGISTERED` → `FORMED` → `SUBMITTED` → `DISQUALIFIED` → `WITHDRAWN`).
2. **Team Roster Management**: Leaders and members with name, email, role (e.g. Lead, Frontend, Backend, ML, Design), and check-in correlation.
3. **Track Alignment**: Linking teams to specific event tracks (e.g., AI/ML, FinTech, Web3, HealthTech).
4. **Symbiosis with Phase 9 & Phase 11**:
   - In Phase 9, `event_assignments` can bind mentors and evaluators to `targetType: 'TEAM'` with `targetId: team._id`.
   - In Phase 11, the Evaluation & Scoring Engine will evaluate submitted teams against weighted rubrics.

---

## 2. Security Boundaries & Invariants
1. **Zero-Trust Event Scoping**: All queries and mutations MUST filter by `{ eventId }` to prevent IDOR across events.
2. **Compound Unique Index**: `{ eventId: 1, teamName: 1 }` prevents name collisions within the same event.
3. **Single Identity Rule**: Team members are referenced by email/name and can correlate with global user accounts and attendee passes without duplicating identity tables.
4. **Roster Constraints**: Configurable min/max team sizes (default min: 1, max: 6) to enforce fair competition rules.

---

## 3. Data Schema: `event_teams` Collection
- `_id`: ObjectId
- `eventId`: ObjectId (indexed, required)
- `teamName`: string (trimmed, required, unique per event)
- `track`: string (e.g., 'AI/ML', 'HealthTech', 'Open Innovation')
- `tableNumber`: string (optional, e.g., 'Table 14', 'Booth B-03')
- `leaderName`: string (required)
- `leaderEmail`: string (required, trimmed, lowercase)
- `members`: Array of:
  - `name`: string
  - `email`: string
  - `role`: string (e.g., 'Leader', 'Developer', 'Designer')
  - `checkedIn`: boolean (default false)
- `projectTitle`: string (optional)
- `projectDescription`: string (optional)
- `repoUrl`: string (optional, sanitized URL)
- `demoUrl`: string (optional, sanitized URL)
- `status`: `'REGISTERED' | 'FORMED' | 'SUBMITTED' | 'DISQUALIFIED' | 'WITHDRAWN'` (default: `'REGISTERED'`)
- `submittedAt`: Date (optional)
- `createdBy`: string (authenticated user ID)
- `createdAt`: Date
- `updatedAt`: Date

Indexes:
- `{ eventId: 1, teamName: 1 }` (unique: true)
- `{ eventId: 1, track: 1 }`
- `{ eventId: 1, status: 1 }`
- `{ eventId: 1, leaderEmail: 1 }`

---

## 4. Layered Architecture Plan
1. **Model**: `server/src/db/mongo/models/event-team.model.ts`
2. **Repository**: `server/src/modules/events/repositories/mongo-event-team.repository.ts`
3. **Service**: `server/src/modules/events/services/event-team.service.ts`
4. **Controller**: `server/src/modules/events/controllers/event-team.controller.ts`
5. **Routes**: `server/src/modules/events/routes/event-team.routes.ts` mounted at `/:eventId/teams`
6. **Frontend**:
   - `client/src/api/events.ts` (API methods and interfaces)
   - `client/src/components/events/EventTeamManagerCard.tsx` (Host/Coordinator team console)
   - Mounted inside `client/src/pages/EventDetailPage.tsx`

---

## 5. Verification Matrix
- Automated test suite `server/tests/eventTeamManagement.test.ts` testing CRUD, track filters, status transitions, roster bounds, and IDOR isolation.
- Full test suite run ensuring 0 regressions across all existing test suites.
- Type checks on server (`tsc`) and client (`npm run build`).
