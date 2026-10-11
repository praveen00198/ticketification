# Phase 8 Audit & Architecture Plan — Volunteer + Coordinator Management

## 1. Executive Summary & Objective
Phase 8 implements the **Volunteer and Coordinator Operational Task Engine** for Ticketification.
Following the completion of Phase 7 (Event Membership & Scoped RBAC), Phase 8 operationalizes the staff roster for day-of-event logistics:
1. **Delegated Coordinator Authority**: Enables Coordinators to manage stations and delegate operational duties without Host master credentials or financial visibility.
2. **Station & Task Assignment Engine (`event_tasks`)**: Formalizes zones/stations (e.g., Gate 1, Swag Desk, Info Desk) and schedules volunteer shifts with real-time status transitions.
3. **Dynamic Scanner Permission Delegation**: Allows Hosts and Coordinators to selectively grant or revoke `SCAN_CREDENTIALS` permissions per volunteer or station.
4. **Volunteer Staff Console**: A dedicated mobile-responsive view for volunteers displaying assigned shifts, station instructions, and dynamic scanning controls under zero-trust least-privilege constraints.

---

## 2. Invariants & Security Guardrails
1. **Zero-Trust Event Scoping**: Every query on tasks MUST filter by `{ eventId, _id: taskId }` to prevent cross-event access (IDOR).
2. **Role Boundaries**:
   - **HOST**: Full administrative power (manage all tasks, assign staff, toggle scanning).
   - **COORDINATOR**: Can create and assign tasks, toggle scanner rights for volunteers, and view all operational logistics.
   - **VOLUNTEER**: Can only view assigned tasks, update their own task status, and scan tickets ONLY if `SCAN_CREDENTIALS` permission is actively granted.
   - **OUTSIDER**: 403 Forbidden on all staff endpoints.
3. **Task Assignment Integrity**: Members assigned to an event task MUST be active members of that specific event (`event_members` record with status `ACTIVE`).
4. **Design Governance**: Emerald (`#10b981`) CTA accents, neutral dark charcoal backgrounds (`#121215`, `#18181b`), zero purple/violet/indigo palette violations.

---

## 3. Data Architecture (`event_tasks` Collection)
```typescript
interface IEventTask {
  _id: ObjectId;
  eventId: ObjectId;
  title: string;
  description?: string;
  category: 'REGISTRATION' | 'SECURITY' | 'LOGISTICS' | 'HOSPITALITY' | 'TECHNICAL' | 'GENERAL';
  station: string;
  assignedMemberIds: ObjectId[];
  shiftStart?: Date;
  shiftEnd?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresScanning: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Compound Indexes:
- `{ eventId: 1, status: 1 }`
- `{ eventId: 1, station: 1 }`
- `{ eventId: 1, assignedMemberIds: 1 }`

---

## 4. Layered Delivery Plan
1. **Mongoose Model**: `server/src/db/mongo/models/event-task.model.ts`
2. **Repository Layer**: `server/src/modules/events/repositories/mongo-event-task.repository.ts`
3. **Service Layer**: `server/src/modules/events/services/event-task.service.ts`
4. **Controller Layer**: `server/src/modules/events/controllers/event-task.controller.ts`
5. **Route Layer**: `server/src/modules/events/routes/event-task.routes.ts`
6. **Automated Test Suite**: `server/tests/eventStaffManagement.test.ts`
7. **Frontend API & Components**:
   - `client/src/api/events.ts` (API methods & types)
   - `client/src/components/events/EventTaskManagerCard.tsx` (Task Manager UI)
   - `client/src/pages/VolunteerConsolePage.tsx` (Volunteer Mobile Console)
8. **Verification & Governance**:
   - Build checks on `server` and `client`.
   - Run full regression tests (150+ tests).
   - Document ADR-022 in `DECISION.md` and advance `PHASES.md`.
