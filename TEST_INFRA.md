# TEST_INFRA.md — E2E Test Suite Infrastructure & Verification Matrix

## 1. Architecture & Design Principles

Ticketification employs a strict, requirement-driven, opaque-box testing architecture. The test suite operates from the perspective of an external HTTP client calling the backend REST endpoints, validating request/response contracts, security boundaries, status codes, data isolation, and transactional integrity.

### 1.1 Core Testing Principles
1. **Opaque-Box Contract Testing**: Tests interact strictly via public HTTP interfaces (`supertest(app)`) and observable side effects. No white-box internal state assumptions.
2. **Deterministic & Isolated**: Each test suite seeds its required data in memory or isolated collections, cleans up after itself (`afterEach` / `afterAll`), and does not depend on test execution order.
3. **Zero-PII Token Validation**: Verifies that auth tokens, verification tokens, and QR strings are cryptographically opaque with zero PII leakage.
4. **Tenant Isolation Verification**: Confirms that event-scoped operations strictly enforce `{ eventId }` checks, preventing IDOR vulnerabilities across accounts and events.
5. **Multi-Tiered Coverage**:
   - **Tier 1: Feature Coverage** (>= 5 test cases per requirement across R1–R6)
   - **Tier 2: Boundary & Corner Cases** (Extreme inputs, malformed headers, expired tokens, concurrent refresh races, missing IDs)
   - **Tier 3: Cross-Feature Interactions** (Pairwise integration of auth + registration, attendee + issue reporting, guest import + check-in)
   - **Tier 4: Real-World Scenarios** (End-to-end user workflows from event registration to turnstile scanning and organizer management)

---

## 2. Runner Configuration & Execution

### 2.1 Test Runner
- **Framework**: Jest (`ts-jest`) with `supertest` for HTTP integration.
- **Config**: `server/jest.config.js`
- **Target Match**: `**/tests/**/*.test.ts`
- **E2E Suite Location**: `server/tests/e2e/`
- **Environment**: Node.js (`testEnvironment: 'node'`)

### 2.2 Execution Commands
- **Run All Tests**:
  ```bash
  npm test
  ```
- **Run E2E Suite Only**:
  ```bash
  npm --prefix server test -- tests/e2e
  ```
- **Run Targeted Tier**:
  ```bash
  npm --prefix server test -- tests/e2e/tier1-r1-auth-session.e2e.test.ts
  npm --prefix server test -- tests/e2e/tier2-boundaries.e2e.test.ts
  npm --prefix server test -- tests/e2e/tier3-cross-feature.e2e.test.ts
  npm --prefix server test -- tests/e2e/tier4-real-world-scenarios.e2e.test.ts
  ```

### 2.3 Pass/Fail Semantics
- **PASS**: All HTTP response codes match specified expectations (e.g., 200, 201, 400, 401, 403, 404). Responses adhere to the JSON envelope format `{ success: true, data: ... }` or `{ success: false, error: { message, code } }`.
- **FAIL**: Any unexpected status code, missing security headers, leaked secrets or internal error stack traces in payloads, IDOR authorization bypass, or database inconsistency.

---

## 3. Requirement Coverage Matrix (R1 – R6)

| Requirement | Scope | Test Suite File | Coverage Count |
|---|---|---|---|
| **R1** | Bearer Token & Session Lifecycle | `tier1-r1-auth-session.e2e.test.ts` | 6 tests |
| **R2** | Supabase & Mongo Integrity | `tier1-r2-data-integrity.e2e.test.ts` | 6 tests |
| **R3** | Global Dashboard vs Attendee Separation | `tier1-r3-r4-dashboard-routing.e2e.test.ts` | 6 tests |
| **R4** | Registrations Routing & Lifecycle | `tier1-r3-r4-dashboard-routing.e2e.test.ts` | 6 tests |
| **R5** | Guest Import RBAC & IDOR Fix | `tier1-r5-guest-import-rbac.e2e.test.ts` | 6 tests |
| **R6** | Product Journey & Scanner Integrity | `tier4-real-world-scenarios.e2e.test.ts` | 5 scenarios |
| **Tier 2** | Boundaries & Corner Cases | `tier2-boundaries.e2e.test.ts` | 8 tests |
| **Tier 3** | Cross-Feature Interactions | `tier3-cross-feature.e2e.test.ts` | 6 tests |
| **Tier 4** | Real-World User Journeys | `tier4-real-world-scenarios.e2e.test.ts` | 5 workflows |

---

## 4. Test Catalog Details

### 4.1 Tier 1: Feature Coverage

#### R1: Bearer Token & Session Lifecycle (`tier1-r1-auth-session.e2e.test.ts`)
1. `R1-TC1`: Valid Bearer token allows access to protected endpoints (`/api/attendee/wallet`).
2. `R1-TC2`: Missing Authorization header returns `401 Unauthorized` with exact error message `"Authentication required. Missing Bearer token."`.
3. `R1-TC3`: Malformed Bearer header (missing "Bearer" prefix, empty token string, lowercase "bearer") returns `401 Unauthorized`.
4. `R1-TC4`: Expired token or invalid cryptographic signature returns `401 Unauthorized`.
5. `R1-TC5`: Refresh token endpoint `POST /api/auth/refresh` issues valid new access token upon receiving valid refresh token.
6. `R1-TC6`: Revoked or invalid refresh token returns `401 Unauthorized` without leaking internal tokens or database errors.

#### R2: Supabase & MongoDB Data Integrity (`tier1-r2-data-integrity.e2e.test.ts`)
1. `R2-TC1`: Dual identity resolution: User lookup succeeds whether queried via `supabaseUserId` or MongoDB `_id`.
2. `R2-TC2`: Event owner query enforces both `ownerSupabaseId` and `ownerId` preventing orphaned host views.
3. `R2-TC3`: Event-scoped query enforces `eventId` filter to prevent cross-event data leaks.
4. `R2-TC4`: Binary-free storage enforcement: MongoDB collections store only structured data and Supabase Storage URLs; raw image buffers are never saved to document fields.
5. `R2-TC5`: Duplicate registration prevention: Attempting duplicate registration for same `{ eventId, user }` returns validation or conflict error.
6. `R2-TC6`: User profile creation does not spawn duplicate phantom records when valid user already exists.

#### R3 & R4: Dashboard Separation & Registration Routing (`tier1-r3-r4-dashboard-routing.e2e.test.ts`)
1. `R3-TC1`: Global user wallet returns only registrations owned by authenticated user.
2. `R3-TC2`: Attendee event view displays attendee tools (schedule, pass status) and excludes host administrative controls.
3. `R3-TC3`: Contextual issue reporting `POST /api/support/report` derives event organizer recipient server-side from `event.ownerId`.
4. `R3-TC4`: Organizer issue viewing endpoint `GET /api/events/:eventId/reports` is restricted to authorized HOST or COORDINATOR.
5. `R4-TC1`: Confirmed active registrations return `CONFIRMED` or `ACTIVE` status for attendee wallet pass rendering.
6. `R4-TC2`: Cancelled or refunded registrations return appropriate status (`CANCELLED`, `REFUNDED`) preventing valid pass issuance.

#### R5: Guest Roster Import & RBAC Enforcement (`tier1-r5-guest-import-rbac.e2e.test.ts`)
1. `R5-TC1`: Ordinary attendee attempting `POST /api/guests/import/:eventId` receives `403 Forbidden` or `404 Not Found`.
2. `R5-TC2`: Authorized host attempting `POST /api/guests/import/:eventId` is permitted to upload guest rosters.
3. `R5-TC3`: Ticket list endpoint `GET /api/tickets/events/:eventId` rejects attendee callers who are not HOST or COORDINATOR.
4. `R5-TC4`: Ticket ZIP export `GET /api/tickets/events/:eventId/export` rejects attendee callers with `404 / 403`.
5. `R5-TC5`: Event member query for host actions strictly verifies caller's `userId` / `userEmail` rather than returning first matching staff member.
6. `R5-TC6`: Turnstile check-in endpoint rejects non-staff callers attempting to check in attendees.

---

### 4.2 Tier 2: Boundary & Corner Cases (`tier2-boundaries.e2e.test.ts`)
1. `T2-BC1`: Empty Authorization header (`""`), single space (`" "`), or `"Bearer "` with trailing spaces returns `401`.
2. `T2-BC2`: Authorization header with special characters or SQL/NoSQL injection string returns `401`.
3. `T2-BC3`: Rapid concurrent refresh calls (`POST /api/auth/refresh`) handle token rotation safely without race conditions.
4. `T2-BC4`: Event-scoped endpoints called with non-existent or malformed MongoDB ObjectId return `404 Not Found` or `400 Bad Request`.
5. `T2-BC5`: Guest import with zero-byte file or non-spreadsheet MIME type returns `400 Bad Request`.
6. `T2-BC6`: Check-in scanner called with empty or malformed token string returns `400 Bad Request`.
7. `T2-BC7`: Issue report with missing mandatory fields (`category`, `subject`, `description`) returns `400 Validation Error`.
8. `T2-BC8`: Cross-event check-in: Ticket issued for Event 1 scanned at Event 2 turnstile returns `WRONG_EVENT`.

---

### 4.3 Tier 3: Cross-Feature Interactions (`tier3-cross-feature.e2e.test.ts`)
1. `T3-XF1`: **Auth + Registration**: Unauthenticated user cannot register; after authenticating, registration succeeds and associates with user profile.
2. `T3-XF2`: **Registration + Wallet Pass**: Upon successful registration, the pass becomes immediately available in `GET /api/attendee/wallet`.
3. `T3-XF3`: **Attendee + Contextual Issue Reporting**: An attendee registered for Event A can submit an issue report for Event A, linking their registration and routing to Event A's host.
4. `T3-XF4`: **Guest Import + Credential Generation**: Host imports guest roster, which creates guest records and generates verifiable ticket tokens.
5. `T3-XF5`: **Guest Credential + Turnstile Check-in**: Valid ticket generated via guest import is scanned at turnstile; first scan succeeds, second scan returns `ALREADY_USED`.
6. `T3-XF6`: **Token Expiry + Re-Authentication**: Expired token fails; after refresh, user resumes wallet access seamlessly.

---

### 4.4 Tier 4: Real-World Scenarios (`tier4-real-world-scenarios.e2e.test.ts`)
1. `T4-RW1`: **Full Attendee Lifecycle**:
   User registers -> views public event -> completes registration -> retrieves wallet pass -> passes turnstile check-in -> turnstile rejects second entry.
2. `T4-RW2`: **Host Event & Roster Lifecycle**:
   Host creates event -> uploads guest spreadsheet -> generates credentials -> turnstile staff scans guest at entry -> attendance logged.
3. `T4-RW3`: **Security Perimeter & Permission Leak Prevention**:
   Attendee attempts to access host guest import -> rejected with 403; attendee attempts to export ticket ZIP -> rejected with 403; attendee attempts to view other attendees' issues -> rejected with 403.
4. `T4-RW4`: **Multi-Event Tenant Isolation**:
   Two hosts create separate events (Event A and Event B); Host A cannot access Event B's guests, tickets, or reports; Host B cannot access Event A's resources.
5. `T4-RW5`: **Issue Reporting to Resolution**:
   Attendee reports badge issue -> system records issue with `registrationId` -> Host queries reports endpoint -> Host views report and updates status.
