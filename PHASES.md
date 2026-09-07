# PHASES.md — Rebuild & Implementation Phases

## Phase Overview & Governance
The rebuild of Ticketification progresses through 11 disciplined, verifiable phases (Phase 0 through Phase 10).

> [!IMPORTANT]
> **Phase Gate Policy**:
> A phase is NOT complete simply because the code compiles.
> A phase is complete ONLY when:
> 1. Implementation is finished.
> 2. Unit and integration tests pass.
> 3. Security checks pass.
> 4. Existing functionality remains intact without regressions.
> 5. Documentation is updated.
> 6. Manual and automated verification succeed.
> 
> **Only ONE phase may be actively implemented at a time.**

---

## Phase Matrix

| Phase | Name | Focus | Phase Gate Verification Criteria |
|---|---|---|---|
| **Phase 0** | **Audit & Governance** | Audit repository, establish rules, documentation, agent skills, and architecture. | Complete audit report, all 9 docs created, 7 skills created, Phase 1 plan approved. |
| **Phase 1** | **Foundation & Auth** | Clean layered module structure, auth middleware, env validation, user profile sync. | Auth registration, login, token refresh, and strict 401/403 authorization checks pass. |
| **Phase 2** | **Events & Guest Management** | Event CRUD, ownership verification, guest CRUD, ticket types seeding. | Event scoping tests pass; cross-user event access strictly blocked. |
| **Phase 3** | **Excel Import Workflow** | Multi-step import: upload, header detection, column mapping, validation preview, batch commit. | Flexible Excel parsing without hardcoded column names; optional phone/email tested. |
| **Phase 4** | **Ticket Generation & PNG Rendering** | High-performance Puppeteer rendering, real PNG binary verification, crypto token QR. | Rendered output passes `isPngBuffer()`; zero SVG output; Ticket ID not printed on image. |
| **Phase 5** | **Supabase Storage Integration** | Dedicated storage provider, bucket validation, path hierarchy, public CDN links. | Verified upload to `ticket-images` bucket; zero fallback to local filesystem on failure. |
| **Phase 6** | **Ticket Downloads & Bulk Export** | Individual download and streaming bulk ZIP of existing PNG assets. | ZIP contains ONLY genuine PNGs; existing assets reused; zero on-demand regenerations. |
| **Phase 7** | **QR Verification & Atomic Check-In** | Scanner API, atomic conditional SQL update, event scoping enforcement. | Simulated concurrent scans verify race-condition prevention; double check-in blocked. |
| **Phase 8** | **Worker Reusable Workflow** | Unassigned worker passes, first-scan name prompt, atomic name save + check-in, repeat scans. | Worker first scan assigns name and checks in atomically; subsequent scans succeed. |
| **Phase 9** | **Hardening & Performance** | Rate limiting, input validation schemas, database indexing, memory optimization. | High-volume batch operations benchmarked; security penetration audit passes. |
| **Phase 10** | **QA & Production Readiness** | End-to-end user journey tests, mobile browser verification, final polish. | Full end-to-end regression suite green; mobile camera test confirmed; deploy ready. |

---

## Current Status
- **Current Active Phase**: **ALL PHASES (Phase 0 through Phase 10) COMPLETED**
- **Phase 0 Status**: COMPLETED (Audit & Governance)
- **Phase 1 Status**: COMPLETED (Build: Pass, Tests: 33/33 Pass, Layering: Enforced)
- **Phase 2 Status**: COMPLETED (Build: Pass, Tests: 54/54 Pass, Zero-Trust IDOR Enforced)
- **Phase 3 Status**: COMPLETED (Build: Pass, Tests: 62/62 Pass, Persistent Staging & Dynamic Mapping Enforced)
- **Phase 4 Status**: COMPLETED (Build: Pass, Tests: 74/74 Pass, Real PNG Binary & Zero SVG Enforced)
- **Phase 5 Status**: COMPLETED (Build: Pass, Tests: 83/83 Pass, Canonical Hierarchy & Zero Local Fallback Enforced)
- **Phase 6 Status**: COMPLETED (Build: Pass, Tests: 88/88 Pass across 8 test suites, Zero On-Demand Regeneration Enforced)
- **Phase 7 Status**: COMPLETED (Build: Pass, Tests: 93/93 Pass across 9 test suites, Atomic Conditional SQL & Race-Condition Proof Check-In Enforced)
- **Phase 8 Status**: COMPLETED (Build: Pass, Tests: 97/97 Pass across 10 test suites, First-Scan Atomic Name Assignment & Multi-Entry Reusable Flow Enforced)
- **Phase 9 Status**: COMPLETED (Build: Pass, Tests: 101/101 Pass across 11 test suites, In-Memory Sliding-Window Rate Limiting & Composite DB Indexing Enforced)
- **Phase 10 Status**: COMPLETED (Build: Pass, Tests: 107/107 Pass across 12 test suites, E2E Contract & Mobile Camera Verification Enforced)
- **System Status**: **PRODUCTION READY — All 11 Phases Rebuilt and Verified.**
