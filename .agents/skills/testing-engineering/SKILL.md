---
name: testing-engineering
description: Testing standards, test suites, regression test policies, and validation gates for Ticketification.
---

# Testing Engineering Skill — Ticketification

## Purpose
Governs testing standards, test case design, regression prevention, and automated verification suites across unit, integration, and end-to-end boundaries.

## When to Use
- Writing tests for newly implemented features or bug fixes.
- Validating phase gates before declaring a phase complete.
- Adding regression tests when fixing any defect.

## Test Pyramid & Structure
```
       / \
      /   \      E2E Tests (Full User Journeys: Upload -> Generate -> Scan)
     /-----\
    /       \    API & Integration Tests (Supertest routes, DB transactions)
   /---------\
  /           \  Unit Tests (Services, Parsers, Sanitizers, Image Validation)
 /-------------\
```

## Mandatory Test Coverage Matrix
1. **Auth & Access**:
   - Register, Login, Logout with Supabase Auth.
   - 401 Unauthorized for missing/invalid bearer tokens.
   - 404/403 for cross-user event access attempts (IDOR).

2. **Excel Import**:
   - Valid file with standard columns (`Name`, `Category`, `Phone`).
   - File with optional phone/email omitted.
   - User-defined column mappings and category mappings.
   - File with missing headers or corrupted rows.

3. **Ticket Generation & Rendering**:
   - VIP & Guest tickets assigned `SINGLE_USE` policy.
   - Worker tickets assigned `REUSABLE` policy.
   - Rendered buffer verified with `isPngBuffer()` (8-byte PNG header check).
   - Filenames correctly formatted (`Rahul-Sharma-GAN-00001.png` or `GAN-00001.png`).
   - Rejection of SVG or corrupted buffers.

4. **Storage & Download**:
   - Individual download retrieves existing PNG asset from Supabase Storage without regenerating.
   - Bulk ZIP download streams existing PNG assets only (no SVG, no manifests inside ZIP unless requested, zero file regenerations).
   - Batching limits prevent memory exhaustion on large sets.

5. **Scanner & Atomic Check-in**:
   - Valid ticket checked in successfully on first scan.
   - Immediate second scan returns `ALREADY_USED` with previous check-in timestamp.
   - Concurrent scan simulation verifies only one request succeeds (atomic conditional update).
   - Ticket belonging to Event B rejected when scanned in Event A with `WRONG_EVENT`.
   - Worker ticket scans successfully multiple times; prompt for worker name on first scan if unassigned.

## Regression Testing Rule
> [!IMPORTANT]
> Whenever a bug is discovered:
> 1. Write a failing test demonstrating the bug.
> 2. Implement the clean architectural fix.
> 3. Verify the test passes.
> 4. Verify all existing tests remain green.

## Verification Checklist
- [ ] `npm test` runs and passes.
- [ ] No flaky mock assertions that bypass database constraints.
- [ ] High-risk concurrency operations tested under simulated race conditions.
