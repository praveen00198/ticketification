# TEST_READY.md — E2E Test Suite Publication

## Test Suite Status: READY FOR VERIFICATION

The 4-tier E2E test suite for **Context-Aware Event Module Visibility & Organization Verification** has been authored, verified against the test runner, and is published for execution by implementation workers and QA reviewers.

---

## 1. Test Suite Metadata

- **Track**: E2E Testing Track (Sub-Orchestration E2E)
- **Primary Executable Suite**: `server/tests/e2eContextAwareModules.test.ts`
- **Opaque Specification**: `tests/e2e/context-aware-modules.spec.ts`
- **Architecture Documentation**: `.agents/teamwork/sub_orch_e2e/TEST_INFRA.md`
- **Test Framework**: Jest (`ts-jest`), `supertest`, Express Node.js environment
- **Total Test Cases**: 47
- **Test Tiers**:
  - **Tier 1 (Feature Coverage)**: 18 Tests (>= 5 per feature across F1, F2, F3)
  - **Tier 2 (Boundary & Corner Cases)**: 18 Tests (>= 5 per feature across F1, F2, F3)
  - **Tier 3 (Pairwise Cross-Feature)**: 6 Tests
  - **Tier 4 (Real-World Scenarios)**: 5 End-to-End Scenarios

---

## 2. How to Run the Tests

```bash
# Run the complete E2E test suite
npm --prefix server test -- tests/e2eContextAwareModules.test.ts

# Run with verbose details
npx --prefix server jest tests/e2eContextAwareModules.test.ts --verbose
```

---

## 3. Baseline Verification Summary

| Metric | Value |
|---|---|
| Total Executed Tests | 47 |
| Current Passing (Baseline Matrix & Public Checks) | 19 |
| Current Pending / Red (Awaiting Milestone M1/M2 Implementation) | 28 |
| Runner Crashes / Hangs | 0 |
| External Network Dependencies | 0 |

---

## 4. Implementation Defect Escalations for Milestone Workers

The 28 failing tests represent deliberate requirements gates awaiting backend (M1) and frontend (M2) implementation:

1. **`F6 / M1` — Private Event Verification Exemption in `publication-readiness.ts`**:
   - `validatePublicationReadiness()` must check `if (event.visibility !== 'private')` before enforcing organization verification.
2. **`F2 / M1` — `hasGuestRoster` in `event-dashboard.service.ts`**:
   - `deriveFeatures()` must include `hasGuestRoster: boolean` (true iff `attendanceMode === 'EXISTING_ATTENDEE_DATA'`).
3. **`F1 / M1` — Guest Mutation Guards in `guest.service.ts` & `guest-import.service.ts`**:
   - Reject guest creation and imports with HTTP 400 when `event.attendanceMode === 'TICKETIFICATION_REGISTRATION'`.
4. **`F5 / M1` — Category Capability Guards in `event-evaluation.service.ts` & `event-assignment.service.ts`**:
   - Reject rubric creation and judge assignments with HTTP 400 when event category lacks `judges` or `evaluators` capability.
5. **`F4 / M2` — Navigation Filtering in `client/src/utils/permissions.ts`**:
   - Filter Guest Roster when native registration is active, and omit judging/teams for weddings, concerts, and conferences.
