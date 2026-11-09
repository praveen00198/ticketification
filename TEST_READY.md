# TEST_READY.md — Ticket Generation Idempotency & Crash Recovery Suite

## Test Suite Status: READY & VERIFIED (100% PASSING)

The automated test suites for **Bulk Ticket Generation Idempotency, Concurrency Control, and Crash Recovery** have been authored, verified against the Jest test runner, and are 100% passing.

---

## 1. Test Suite Metadata

- **Track**: E2E Testing Track (Subagent: `test_writer_1`)
- **Primary Executable Test Suites**:
  1. `server/tests/ticketGenerationIdempotency.test.ts` (7 tests)
  2. `server/tests/ticketGenerationCrashRecovery.test.ts` (8 tests)
- **Infrastructure Documentation**: `TEST_INFRA.md`
- **Test Framework**: Jest (`ts-jest`), Node.js v20+ environment
- **Total Test Cases**: 15
- **Execution Time**: ~8.7 seconds
- **Pass / Fail Results**: **15 Passed, 0 Failed (100% Pass Rate)**

---

## 2. Acceptance Criteria Verification Matrix

| Acceptance Criterion | Test Suite | Tests | Result |
|---|---|---|---|
| **AC-1**: Resuming job with N logical tickets and M completed processes only N - M | `ticketGenerationIdempotency.test.ts` | `when N=10 tickets have M=4 already completed, resume processes ONLY the remaining 6 tickets` | **PASSED** |
| **AC-2**: Final job produces exactly N records and N assets | `ticketGenerationIdempotency.test.ts` | `recovering from interruption results in exactly N records in DB and exactly N assets in storage` | **PASSED** |
| **AC-3**: No duplicate ticket IDs or duplicate records under crash, retry, or repeated Continue | `ticketGenerationIdempotency.test.ts` | `generates strictly unique sequence numbers, formatted IDs, and verification tokens across retries`<br>`import job retries reuse previously allocated startingSequence without creating duplicate records`<br>`multi-ticket registrations preserve distinct tickets without duplicate collision` | **PASSED** |
| **AC-4**: No completed PNG assets regenerated on resume | `ticketGenerationIdempotency.test.ts` | `storage pre-check detects existing PNG assets in Supabase and skips Sharp rasterization entirely` | **PASSED** |
| **AC-5**: Concurrent resume / multiple Continue clicks do not spawn duplicate jobs or process duplicate tickets | `ticketGenerationIdempotency.test.ts` | `multiple concurrent Continue clicks coalesce into the existing active job and do not spawn duplicate jobs` | **PASSED** |
| **AC-6**: Two concurrent workers cannot generate the same logical ticket simultaneously | `ticketGenerationCrashRecovery.test.ts` | `concurrent workers with atomic ticket leases claim disjoint tickets and never collide on the same ticket` | **PASSED** |
| **AC-7**: Abandoned tickets in PROCESSING state due to worker crashes are safely reclaimed after lease expiration and processed to completion | `ticketGenerationCrashRecovery.test.ts` | `expired processing lease from a crashed worker is reclaimed to PENDING and processed to completion by a healthy worker`<br>`claimUnrenderedTicketLease atomically reclaims expired PROCESSING lease directly if not batch-reclaimed` | **PASSED** |
| **AC-8**: Comprehensive crash scenarios (8A, 8B, 8C, 8D, 8E) | `ticketGenerationCrashRecovery.test.ts` | `Scenario 8A (Crash before upload)`<br>`Scenario 8B (Crash between upload and MongoDB save)`<br>`Scenario 8C (Crash after completion & Repeated Continue)`<br>`Scenario 8D (Server restart & Immediate startup recovery)`<br>`Scenario 8E (Repeated Continue clicks while actively running)` | **PASSED** |

---

## 3. How to Run the Tests

```bash
# Run all ticket generation idempotency and crash recovery tests
npm test -- ticketGeneration

# Run only the idempotency & resume test suite
npm test -- ticketGenerationIdempotency.test.ts

# Run only the crash recovery & concurrency safety suite
npm test -- ticketGenerationCrashRecovery.test.ts

# Run with verbose details
npx --prefix server jest ticketGeneration --verbose
```

---

## 4. Key Engineering Invariants Verified

1. **Storage Pre-Check & Asset Reuse**: Before Sharp rasterization, the pipeline checks if `events/${eventId}/credentials/${credentialId}.png` exists in Supabase Storage. Existing PNGs are reused without invoking Sharp, bounding CPU and memory consumption.
2. **Deterministic Sequence Allocation**: Monotonic sequence numbers and formatted IDs (`TIC-00001` .. `TIC-0000N`) are strictly preserved across retries. Multi-ticket registrations allocate sequential blocks without collision.
3. **Active Job Coalescing**: Multiple concurrent "Continue" clicks coalesce into the single existing active job document (`QUEUED` or `PROCESSING`), preventing queue explosion and duplicate workers.
4. **Atomic Ticket Leases**: Individual credentials support atomic row-level leases (`renderingLockedBy`, `renderingLockExpiresAt`). Two concurrent workers never claim or render the same ticket simultaneously.
5. **Immediate Startup Recovery**: Server restarts trigger immediate recovery of active `PROCESSING` jobs without imposing arbitrary 10-minute lockouts.
