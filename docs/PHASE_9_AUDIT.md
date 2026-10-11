# Phase 9 Audit & Architecture Plan — Mentor + Evaluator System

## 1. Executive Summary & Objective
Phase 9 implements the **Mentor & Evaluator Workspace and Assignment System** for Ticketification.
Supporting hackathons, competitions, workshops, and multi-track conferences, Phase 9 establishes:
1. **Restricted Workspaces**: Tailored operational consoles for Mentors and Evaluators (Judges), enforcing least-privilege access so they only view teams and tracks assigned to them.
2. **Blind Review & Evaluation Scoping**: Evaluators are scoped to specific problem tracks, rounds, or anonymized teams without exposing other judges' individual scoring sheets.
3. **Mentorship Logging & Guidance**: Mentors can view their assigned hacker cohorts, log consultation notes, and track team progress.
4. **Host/Coordinator Assignment Delegation**: Hosts and Coordinators can assign, rebalance, and revoke mentor and judge assignments on the fly.

---

## 2. Invariants & Security Guardrails
1. **Zero-Trust Event Scoping**: Every assignment query or mutation MUST explicitly filter by `{ eventId, _id: assignmentId }` to eliminate cross-event IDOR vulnerabilities.
2. **Role Boundaries & Permissions**:
   - `HOST` & `COORDINATOR`: Authorized to manage assignments (`MANAGE_STAFF` or `MANAGE_EVENT_SETTINGS`).
   - `MENTOR`: Possesses `MENTOR_ASSIGNED_TEAMS`; can view their assigned teams/tracks and log advice.
   - `EVALUATOR`: Possesses `SCORE_ASSIGNED_TEAMS` and `VIEW_EVALUATION_RESULTS`; isolated to assigned tracks and blind rubric entries.
   - Regular volunteers and attendees are 403 Forbidden on assignment configuration.
3. **Single Identity Invariant**: Mentors and Evaluators are global users bound via `event_members` with roles `MENTOR` and `EVALUATOR`.
4. **Design Governance**: Emerald (`#10b981`) CTA accents, neutral dark charcoal backgrounds (`#121215`, `#18181b`), zero purple/violet/indigo palette violations.

---

## 3. Data Architecture (`event_assignments` Collection)
```typescript
export interface IEventAssignment {
  _id: ObjectId;
  eventId: ObjectId;
  memberId: ObjectId; // References event_members
  role: 'MENTOR' | 'EVALUATOR';
  track?: string;
  assignedTargetType: 'TRACK' | 'TEAM' | 'GENERAL';
  targetId?: string;
  targetName: string; // e.g. "Track: AI & Data Science" or "Team Alpha"
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  mentorshipLogs?: Array<{
    authorEmail: string;
    note: string;
    timestamp: Date;
  }>;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Compound Indexes:
- `{ eventId: 1, memberId: 1, targetName: 1 }` (unique compound index)
- `{ eventId: 1, role: 1 }`
- `{ eventId: 1, track: 1 }`

---

## 4. Layered Delivery Plan
1. **Mongoose Model**: `server/src/db/mongo/models/event-assignment.model.ts`
2. **Repository Layer**: `server/src/modules/events/repositories/mongo-event-assignment.repository.ts`
3. **Service Layer**: `server/src/modules/events/services/event-assignment.service.ts`
4. **Controller Layer**: `server/src/modules/events/controllers/event-assignment.controller.ts`
5. **Route Layer**: `server/src/modules/events/routes/event-assignment.routes.ts`
6. **Automated Test Suite**: `server/tests/mentorEvaluatorSystem.test.ts`
7. **Frontend API & Components**:
   - `client/src/api/events.ts` (API methods & types)
   - `client/src/components/events/EventAssignmentCard.tsx` (Host Assignment Management Card)
   - `client/src/pages/MentorEvaluatorWorkspacePage.tsx` (Mentor/Judge Workspace Portal)
8. **Verification & Governance**:
   - Build checks on `server` and `client`.
   - Run full regression tests (160+ tests).
   - Document ADR-023 in `DECISION.md` and advance `PHASES.md`.
