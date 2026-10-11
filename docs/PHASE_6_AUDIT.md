# Phase 6 Audit & Implementation Plan — Event Lifecycle Engine

## 1. Executive Summary
Phase 6 implements the authoritative **Event Lifecycle Engine** for Ticketification. In earlier phases (Phases 1–5), events were created in `DRAFT` and could be submitted to `SUBMITTED`, with admin review transitioning to `APPROVED` or `REJECTED`. However, the full lifecycle (`DRAFT` ➔ `SUBMITTED` ➔ `APPROVED` ➔ `PUBLISHED` ➔ `REGISTRATION_OPEN` ➔ `REGISTRATION_CLOSED` ➔ `EVENT_LIVE` ➔ `COMPLETED` ➔ `ARCHIVED`, with `SUSPENDED` and `CANCELLED` branches) is not yet governed by a centralized state machine with immutable transition history and emergency circuit breakers.

---

## 2. Current Implementation Analysis & Gap Identification

| Area | Current Implementation | Target Specification (PRD & Architecture) | Status / Gap |
|---|---|---|---|
| **Event Status Enum** | `EVENT_STATUSES` has all 13 states in `event.model.ts` | 13 states (`DRAFT` through `ARCHIVED`, `SUSPENDED`, `CANCELLED`) | Model has enum, but state transitions are unconstrained |
| **State Transition Validation** | Direct mutations permitted; no transition matrix | Centralized state machine with strict transition guards | **GAP**: Must reject illegal transitions (e.g. `DRAFT` ➔ `PUBLISHED`) |
| **Audit Trail (`statusHistory`)** | Absent | Embedded immutable transition log: `{ fromStatus, toStatus, changedBy, reason, timestamp }` | **GAP**: Model lacks `statusHistory` array |
| **Pre-Publish Gate** | Unenforced | Events MUST be verified (`verificationStatus === 'VERIFIED'`) before publishing | **GAP**: Enforce Phase 5 verification before publishing |
| **Circuit Breakers** | None | Admin emergency suspension freezes registrations and check-ins; cancellation blocks attendance | **GAP**: Implement suspension endpoints & assertion helpers |
| **Host Lifecycle Routes** | None | Endpoints for publish, open/close registrations, go live, complete, archive, cancel | **GAP**: Create lifecycle routes & controller |
| **Admin Circuit Breaker Routes** | None | `POST /api/admin/events/:eventId/suspend` and `reinstate` | **GAP**: Mount admin event lifecycle control |
| **Frontend UI Controls** | Basic status chip | Dynamic Lifecycle Action Bar, state timeline stepper, action modals | **GAP**: Build context-aware lifecycle UI in `EventDetailPage` |

---

## 3. Strict State Transition Matrix

```
       ┌───────────┐
       │   DRAFT   │
       └─────┬─────┘
             │ (Submit for review)
             ▼
       ┌───────────┐
       │ SUBMITTED │ ◄─────────────────────┐
       └─────┬─────┘                       │
             │ (Admin review)              │
      ┌──────┴──────┐                      │
      ▼             ▼                      │
┌───────────┐ ┌───────────┐                │
│ REJECTED  │ │ APPROVED  │                │
└─────┬─────┘ └─────┬─────┘                │
      │             │ (Host publish)       │
      │ (Fix)       ▼                      │
      │       ┌───────────┐                │
      └──────►│ PUBLISHED │                │
              └─────┬─────┘                │
                    │ (Open registration)  │
                    ▼                      │
       ┌────────────────────────┐          │
       │   REGISTRATION_OPEN    │          │
       └────────────┬───────────┘          │
                    │ (Cap/Deadline)       │
                    ▼                      │
       ┌────────────────────────┐          │
       │  REGISTRATION_CLOSED   │          │
       └────────────┬───────────┘          │
                    │ (Event Day Begins)   │
                    ▼                      │
       ┌────────────────────────┐          │
       │       EVENT_LIVE       │          │
       └────────────┬───────────┘          │
                    │ (Concludes)          │
                    ▼                      │
       ┌────────────────────────┐          │
       │       COMPLETED        │          │
       └────────────┬───────────┘          │
                    │ (Seal Records)       │
                    ▼                      │
       ┌────────────────────────┐          │
       │        ARCHIVED        │          │
       └────────────────────────┘          │
                                           │
  Emergency Branches:                      │
  - ANY ACTIVE STATE ──► SUSPENDED (Admin) ─┘ (Reinstate)
  - PUBLISHED / REG_OPEN ──► CANCELLED (Host)
```

### Allowed Transitions:
1. `DRAFT` ➔ `SUBMITTED`, `CANCELLED`
2. `SUBMITTED` ➔ `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`
3. `UNDER_REVIEW` ➔ `APPROVED`, `REJECTED`, `SUSPENDED`
4. `REJECTED` ➔ `DRAFT` (Host resolves issues)
5. `APPROVED` ➔ `PUBLISHED`, `SUSPENDED`
6. `PUBLISHED` ➔ `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `EVENT_LIVE`, `CANCELLED`, `SUSPENDED`
7. `REGISTRATION_OPEN` ➔ `REGISTRATION_CLOSED`, `EVENT_LIVE`, `CANCELLED`, `SUSPENDED`
8. `REGISTRATION_CLOSED` ➔ `REGISTRATION_OPEN`, `EVENT_LIVE`, `CANCELLED`, `SUSPENDED`
9. `EVENT_LIVE` ➔ `COMPLETED`, `SUSPENDED`
10. `COMPLETED` ➔ `ARCHIVED`
11. `ARCHIVED` ➔ *TERMINAL (No mutations allowed)*
12. `SUSPENDED` ➔ `APPROVED` / `PUBLISHED` / `REGISTRATION_OPEN` / `DRAFT` (Reinstated by Admin)
13. `CANCELLED` ➔ *TERMINAL*

---

## 4. Implementation Plan

### Step 1: Model Extension
- Extend `server/src/db/mongo/models/event.model.ts`:
  - Add `IEventStatusHistory` interface and schema: `{ fromStatus, toStatus, changedBy, changedBySupabaseId, reason, timestamp }`.
  - Add `statusHistory: IEventStatusHistory[]`.
  - Add `suspensionReason?: string`, `suspendedAt?: Date`, `suspendedBy?: ObjectId`.
  - Add `cancellationReason?: string`, `cancelledAt?: Date`.

### Step 2: Repository Layer
- Extend `MongoEventRepository`:
  - `transitionStatus(eventId, newStatus, historyEntry, extraFields)`: Conditional atomic update.
  - `findByIdAndOwner`: Retrieve with status history.

### Step 3: Service Layer
- Create `EventLifecycleService`:
  - `transitionStatus(eventId, userId, targetStatus, reason)`:
    - Verifies event ownership or admin role.
    - Validates state transition legality according to the matrix.
    - Enforces business gates (e.g., cannot publish unless verified; cannot register if archived or suspended).
    - Writes immutable status history.
  - Convenience methods:
    - `publishEvent(eventId, userId)`
    - `openRegistration(eventId, userId)`
    - `closeRegistration(eventId, userId)`
    - `startLiveEvent(eventId, userId)`
    - `completeEvent(eventId, userId)`
    - `archiveEvent(eventId, userId)`
    - `cancelEvent(eventId, userId, reason)`
    - `suspendEvent(eventId, adminUserId, reason)` (Platform Admin only)
    - `reinstateEvent(eventId, adminUserId, targetStatus, reason)` (Platform Admin only)
    - `assertEventActive(event)`: Circuit breaker utility.

### Step 4: Controller & Routes Layer
- Create `EventLifecycleController`:
  - Handles host lifecycle endpoints.
  - Handles admin circuit breaker endpoints.
- Mount routes:
  - `POST /api/events/:eventId/lifecycle/transition`
  - `POST /api/events/:eventId/publish`
  - `POST /api/events/:eventId/registrations/open`
  - `POST /api/events/:eventId/registrations/close`
  - `POST /api/events/:eventId/live`
  - `POST /api/events/:eventId/complete`
  - `POST /api/events/:eventId/archive`
  - `POST /api/events/:eventId/cancel`
  - `GET /api/events/:eventId/lifecycle/history`
  - `POST /api/admin/events/:eventId/suspend`
  - `POST /api/admin/events/:eventId/reinstate`

### Step 5: Test Suite
- Create `server/tests/eventLifecycle.test.ts`:
  - Tests all legal transitions.
  - Tests illegal transitions (e.g. `DRAFT` ➔ `PUBLISHED` without approval).
  - Tests verification gate (cannot publish unverified event).
  - Tests IDOR protection (non-owner cannot mutate lifecycle).
  - Tests Admin circuit breaker (suspension & reinstatement).
  - Tests immutable `statusHistory` logging.

### Step 6: Frontend Integration
- Extend `client/src/api/events.ts` with lifecycle endpoints.
- Build `client/src/components/events/EventLifecycleBar.tsx`:
  - State stepper timeline.
  - Contextual action buttons (Publish, Open/Close Registrations, Go Live, Conclude, Archive, Cancel).
  - Emerald `#10b981` accents, neutral dark/light surfaces, zero forbidden purple colors.
- Mount into `client/src/pages/EventDetailPage.tsx`.

### Step 7: Documentation & Phase Gate
- Record ADR-020 in `DECISION.md`.
- Update `ARCHITECTURE.md` and `PHASES.md`.
