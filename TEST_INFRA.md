# TEST_INFRA.md — Test Suite Infrastructure & Verification Matrix

**Platform**: Ticketification (Event Operating + Credential + Access Platform)  
**Test Framework**: Jest (`ts-jest`) with `supertest` for HTTP integration  
**Working Environment**: Node.js v20+ / Windows PowerShell / Monorepo  
**Target Domains**: Authentication, Security, RBAC, Data Integrity, Bulk Ticket Generation Idempotency, Concurrency Control & Crash Recovery  
**Test Suites Location**: `server/tests/`

---

## 1. Architecture & Testing Principles

Ticketification employs a strict, requirement-driven, deterministic testing architecture. Testing validates request/response contracts, security boundaries, status codes, data isolation, atomic leases, and transactional integrity.

### 1.1 Core Testing Principles
1. **Opaque-Box Contract Testing**: Tests interact via public HTTP interfaces (`supertest(app)`) and domain service boundaries (`EventJobQueueService`, `EventCredentialRenderingService`, repository contracts).
2. **Deterministic & Isolated**: Each test suite seeds its required state in-memory (`inMemoryJobs`, `inMemoryCredentials`, `inMemoryStorage`), cleans up after itself (`beforeEach`/`afterEach`), and does not depend on test execution order.
3. **Zero External Cloud Dependencies**: Tests run reliably in offline CI/CD without requiring live MongoDB instances or external Supabase cloud services.
4. **Tenant Isolation Verification**: Confirms that event-scoped operations strictly enforce `{ eventId }` checks, preventing IDOR vulnerabilities across accounts and events.
5. **High-Throughput Atomic Verification**: Validates race condition immunity and single-use token consumption using atomic conditional update semantics.

---

## 2. Bulk Ticket Generation Idempotency & Crash Recovery Architecture

The automated test infrastructure for Ticketification's ticket generation pipeline guarantees absolute idempotency, concurrency safety, and crash recovery across all 8 user requirements and acceptance criteria.

```
+---------------------------------------------------------------------------------------------------------+
|                                        Jest Test Runner & Spies                                         |
+---------------------------------------------------------------------------------------------------------+
                                    |                                    |
          +-------------------------+                                    +-------------------------+
          v                                                                                        v
+------------------------------------+                                   +------------------------------------+
|  ticketGenerationIdempotency.test  |                                   | ticketGenerationCrashRecovery.test |
|   - AC-1: N - M Resume             |                                   |   - AC-6: Worker Collisions        |
|   - AC-2: Exact N Records & Assets |                                   |   - AC-7: Lease Reclamation        |
|   - AC-3: Duplicate Protection     |                                   |   - AC-8: Crash Scenarios          |
|   - AC-4: Storage Pre-Check        |                                   |     - 8A: Crash Before Upload      |
|   - AC-5: Active Job Coalescing    |                                   |     - 8B: Crash Before DB Save     |
|                                    |                                   |     - 8C: Post-Completion Continue |
|                                    |                                   |     - 8D: Startup Force-Recovery   |
|                                    |                                   |     - 8E: Repeated Active Continue |
+------------------------------------+                                   +------------------------------------+
                                    \                                    /
                                     v                                  v
+---------------------------------------------------------------------------------------------------------+
|                                    Deterministic In-Memory Test Harness                                 |
|  - inMemoryJobs: Map<string, IEventJobDocument>       - inMemoryStorage: Map<string, Buffer>            |
|  - inMemoryCredentials: Map<string, ICredential>      - sharpCallCount: atomic invocation tracking      |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 In-Memory Test Harness Design Patterns
In strict compliance with repository patterns established in `server/tests/bulkRenderReliabilityIntegration.test.ts`:
- **`inMemoryJobs: Map<string, any>`**: High-fidelity representation of MongoDB `event_jobs` collection. Enforces atomic states (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), lease expirations (`lockExpiresAt`), retry counters (`attempts`, `maxAttempts`), and progress metrics.
- **`inMemoryCredentials: Map<string, any>`**: High-fidelity representation of MongoDB `event_credentials` collection. Enforces per-ticket rendering state (`renderStatus`: `'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'`), worker lease ownership (`renderingLockedBy`, `renderingLockExpiresAt`), and storage URLs.
- **`inMemoryStorage: Map<string, Buffer>`**: High-fidelity simulation of Supabase Storage bucket (`ticket-images`), verifying deterministic path canonicalization (`events/${eventId}/credentials/${credentialId}.png`).

---

## 3. Test Coverage Tiers & Acceptance Criteria Matrix

### 3.1 Idempotency & Resume Coverage (`server/tests/ticketGenerationIdempotency.test.ts`)

| Acceptance Criterion | Verification Test Case | Status |
|---|---|---|
| **AC-1**: Resuming job with N logical tickets and M completed processes only N - M | `when N=10 tickets have M=4 already completed, resume processes ONLY the remaining 6 tickets` | **VERIFIED (PASS)** |
| **AC-2**: Final job produces exactly N records and N assets | `recovering from interruption results in exactly N records in DB and exactly N assets in storage` | **VERIFIED (PASS)** |
| **AC-3**: No duplicate ticket IDs or duplicate records under crash, retry, or repeated Continue | `generates strictly unique sequence numbers, formatted IDs, and verification tokens across retries`<br>`import job retries reuse previously allocated startingSequence without creating duplicate records`<br>`multi-ticket registrations preserve distinct tickets without duplicate collision` | **VERIFIED (PASS)** |
| **AC-4**: No completed PNG assets regenerated on resume | `storage pre-check detects existing PNG assets in Supabase and skips Sharp rasterization entirely` | **VERIFIED (PASS)** |
| **AC-5**: Concurrent resume / multiple Continue clicks do not spawn duplicate jobs or process duplicate tickets | `multiple concurrent Continue clicks coalesce into the existing active job and do not spawn duplicate jobs` | **VERIFIED (PASS)** |

### 3.2 Crash Recovery & Concurrency Safety Coverage (`server/tests/ticketGenerationCrashRecovery.test.ts`)

| Acceptance Criterion | Verification Test Case | Status |
|---|---|---|
| **AC-6**: Two concurrent workers cannot generate the same logical ticket simultaneously | `concurrent workers with atomic ticket leases claim disjoint tickets and never collide on the same ticket` | **VERIFIED (PASS)** |
| **AC-7**: Abandoned tickets in PROCESSING state due to worker crashes are safely reclaimed after lease expiration and processed to completion | `expired processing lease from a crashed worker is reclaimed to PENDING and processed to completion by a healthy worker`<br>`claimUnrenderedTicketLease atomically reclaims expired PROCESSING lease directly if not batch-reclaimed` | **VERIFIED (PASS)** |
| **AC-8A**: Crash before storage upload | `Scenario 8A (Crash before upload): failure before upload leaves ticket clean for subsequent retry` | **VERIFIED (PASS)** |
| **AC-8B**: Crash between upload and MongoDB save | `Scenario 8B (Crash between upload and MongoDB save): detects existing storage asset, skips Sharp, and commits DB` | **VERIFIED (PASS)** |
| **AC-8C**: Crash after completion & Repeated Continue | `Scenario 8C (Crash after completion & Repeated Continue): immediately completes without re-rendering or overwriting` | **VERIFIED (PASS)** |
| **AC-8D**: Server restart & Immediate startup recovery | `Scenario 8D (Server restart & Immediate startup recovery): reclaims active processing jobs immediately without 10-minute lockout` | **VERIFIED (PASS)** |
| **AC-8E**: Repeated Continue clicks while actively running | `Scenario 8E (Repeated Continue clicks while actively running): does not disrupt active worker or spawn duplicate jobs` | **VERIFIED (PASS)** |

---

## 4. Test Catalog Inventory & Execution Commands

### 4.1 Running All Ticket Generation Test Suites
```bash
npm test -- ticketGeneration
```

### 4.2 Running Specific Test Suites
```bash
# Run Idempotency & Safe Resume Suite
npm test -- ticketGenerationIdempotency.test.ts

# Run Crash Recovery & Concurrency Safety Suite
npm test -- ticketGenerationCrashRecovery.test.ts

# Run Bulk Render Reliability Integration Suite
npm test -- bulkRenderReliabilityIntegration.test.ts
```

### 4.3 Running Entire Test Suite
```bash
npm test
```
