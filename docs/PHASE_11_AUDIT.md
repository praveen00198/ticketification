# Phase 11 Implementation Audit: Evaluation & Scoring Engine Architecture

## 1. Executive Summary & Domain Scope
In competitive events such as hackathons, design sprints, and case competitions, teams must be evaluated fairly, objectively, and transparently using structured assessment criteria.
**Phase 11: Evaluation & Scoring Engine** completes the competitive triad established by Phase 9 (Mentor & Evaluator System) and Phase 10 (Team Management) by introducing:
1. **Configurable Evaluation Rubrics (`event_rubrics`)**: Event organizers configure weighted scoring criteria per track or general event (e.g. Innovation 30%, Technical Execution 40%, Design & UX 15%, Business Viability 15%).
2. **Scorecard Submission Engine (`event_evaluations`)**: Assigned evaluators submit atomic scorecards per team with numeric scores and qualitative feedback.
3. **Lifecycle & Locking Controls**: Rubric scoring phases (`OPEN` → `CLOSED` → `FINALIZED`). Submissions are permitted only while `OPEN`; scores are immutable once closed.
4. **Blind Review Isolation Invariant**: Competing judge scorecards and live rankings remain strictly masked from evaluators to eliminate anchoring bias until explicitly finalized by the host.
5. **Leaderboard & Ranking Analytics**: Weighted score aggregation, tie-breakers, and leaderboard calculation.

---

## 2. Security Boundaries & Invariants
1. **Zero-Trust Event Scoping**: All queries and mutations verify `{ eventId }` to eliminate cross-event IDOR.
2. **Evaluator Identity & Authorization**:
   - Evaluators must have active `EVALUATOR`, `COORDINATOR`, or `HOST` roles in `event_members`.
   - Scorecard uniqueness: Compound unique index `{ eventId: 1, teamId: 1, evaluatorMemberId: 1 }` prevents double-scoring by the same judge.
3. **Blind Review Boundary**:
   - While scoring is `OPEN` or `CLOSED`, evaluators can ONLY query their own submitted scorecards (`evaluatorMemberId == callerMemberId`).
   - Only hosts/coordinators can inspect all judge scorecards and live aggregate tallies.
4. **Score Bounds Validation**:
   - Every criteria score must satisfy `0 <= score <= maxScore`.
   - Weights must be positive numbers.

---

## 3. Data Collections Schema

### A. `event_rubrics`
- `_id`: ObjectId
- `eventId`: ObjectId (required, indexed)
- `title`: string (e.g. 'Main Track Hackathon Rubric')
- `track`: string (default: 'General')
- `criteria`: Array of:
  - `key`: string (e.g. 'tech_complexity')
  - `label`: string (e.g. 'Technical Execution')
  - `maxScore`: number (e.g. 10 or 100)
  - `weight`: number (percentage or factor, e.g. 40)
  - `description`: string
- `scoringStatus`: `'OPEN' | 'CLOSED' | 'FINALIZED'` (default: `'OPEN'`)
- `createdBy`: ObjectId
- `timestamps`: true

### B. `event_evaluations`
- `_id`: ObjectId
- `eventId`: ObjectId (required, indexed)
- `rubricId`: ObjectId (required, indexed)
- `teamId`: ObjectId (required, indexed)
- `evaluatorMemberId`: ObjectId (required, indexed)
- `evaluatorEmail`: string
- `evaluatorName`: string
- `scores`: Array of:
  - `criteriaKey`: string
  - `score`: number
  - `feedback`: string
- `weightedTotal`: number (pre-calculated normalized aggregate)
- `generalFeedback`: string
- `status`: `'DRAFT' | 'SUBMITTED'`
- `submittedAt`: Date
- `timestamps`: true

Indexes:
- `{ eventId: 1, teamId: 1, evaluatorMemberId: 1 }` (unique: true)
- `{ eventId: 1, rubricId: 1 }`
- `{ eventId: 1, teamId: 1 }`
- `{ eventId: 1, status: 1 }`

---

## 4. Layered Architecture Implementation
1. **Models**:
   - `server/src/db/mongo/models/event-rubric.model.ts`
   - `server/src/db/mongo/models/event-evaluation.model.ts`
2. **Repositories**:
   - `server/src/modules/events/repositories/mongo-event-rubric.repository.ts`
   - `server/src/modules/events/repositories/mongo-event-evaluation.repository.ts`
3. **Service**:
   - `server/src/modules/events/services/event-evaluation.service.ts`
4. **Controller**:
   - `server/src/modules/events/controllers/event-evaluation.controller.ts`
5. **Routes**:
   - `server/src/modules/events/routes/event-evaluation.routes.ts` mounted in `event.routes.ts`
6. **Frontend Integration**:
   - API client methods in `client/src/api/events.ts`.
   - Host console card `EventEvaluationCard.tsx` in `EventDetailPage.tsx`.
   - Evaluator scorecard scoring modal in `MentorEvaluatorWorkspacePage.tsx`.

---

## 5. Verification Matrix
- Automated test suite `server/tests/evaluationScoringEngine.test.ts`.
- Full regression suite across all 12 existing test suites (189+ tests).
- Clean compilation on client and server.
