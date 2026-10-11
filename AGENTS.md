# AGENTS.md — Permanent Project Rules & Engineering Governance

## 1. Project Purpose & Scope
Ticketification is an **Event Operating + Credential + Access Platform** supporting diverse event types (Hackathons, Conferences, Concerts, Festivals, Workshops, Competitions, etc.). It enables event organizers (Hosts) to configure events, manage attendees, coordinate staff (Coordinators, Volunteers, Mentors, Evaluators), issue tamper-proof visual credentials with dynamic QR codes, run blind evaluation rubrics, and execute high-throughput, atomic day-of-event access control.

---

## 2. Engineering Governance & Sources of Truth
The following documentation files in the project root constitute the single engineering source of truth:
1. `PRD.md` — Product Requirements Document (Vision, Surfaces, Taxonomy, Lifecycle)
2. `ARCHITECTURE.md` — System Architecture & Layered Boundaries (Triad, Models, RBAC)
3. `RULES.md` — Non-negotiable Engineering Rules & Invariants
4. `PHASES.md` — 22-Phase Roadmap & Phase Gate Definitions
5. `DESIGN.md` — Design System & Visual Specification (Context-Aware UX, Obsidian/Emerald)
6. `MEMORY.md` — Operational Knowledge & Architecture Truths
7. `AGENTS.md` — Agent Guidelines & Invariants (this file)
8. `DECISION.md` — Architecture Decision Records (ADRs)
9. `TESTING.md` — Test Strategy & Verification Matrix

Requirements must never exist solely inside chat messages. Future agents MUST consult these documents before modifying system architecture.

---

## 3. Mandatory Agent Workflow (13-Step Cycle)
Whenever any task or modification is requested:
1. **Read project documentation first** (`PRD.md`, `ARCHITECTURE.md`, `RULES.md`, `DECISION.md`, `MEMORY.md`).
2. **Read relevant skills** in `.agents/skills/` before working in that domain.
3. **Inspect only relevant code** — do not blindly scan the entire repository.
4. **Understand existing architecture** and dependency direction.
5. **Determine scope** and identify potential side-effects.
6. **Create an implementation plan** (if non-trivial).
7. **Implement the smallest correct change**.
8. **Follow strict layered architecture**:
   `Route` ➔ `Controller` ➔ `Validation` ➔ `Service` ➔ `Repository` ➔ `Database/Storage`.
9. **Test the change** using automated test suites (`npm test`).
10. **Run regression checks** on related modules.
11. **Verify actual behavior** (type check `npm run build` on both client and server).
12. **Update documentation** (`ARCHITECTURE.md`, `DECISION.md`, `MEMORY.md` as needed).
13. **Report exactly what changed**.

---

## 4. Absolute Invariants for Agents
Future coding agents MUST strictly follow these rules:
1. **Read Architecture Docs First**: Never change core systems without reading `ARCHITECTURE.md`, `RULES.md`, and `DECISION.md`.
2. **Never Bypass Backend Authorization**: The backend is the sole security boundary. Never trust client-side route guards or `localStorage` roles.
3. **Never Trust Frontend Role State**: Never read user roles from frontend requests; always evaluate roles and permissions via MongoDB `event_members`.
4. **Never Create Duplicate Identity Systems**: Enforce ONE global user identity. Roles (Host, Volunteer, Mentor, Evaluator, Attendee) are event-scoped relationships, not separate user tables.
5. **Never Store Large Files in MongoDB**: MongoDB stores structured documents only. PNGs, PDFs, spreadsheets, and ZIP archives belong exclusively in Supabase Storage.
6. **Never Create Synchronous Bulk Endpoints**: Operations generating credentials or exporting ZIPs for 50+ records MUST execute asynchronously via background jobs.
7. **Never Add Microservices**: The system is a Modular Monolith. Do not introduce microservices or distributed queues without documented architectural justification.
8. **Preserve Event Isolation**: Every query accessing event-scoped entities must explicitly filter by `{ eventId }` to prevent cross-event data leaks (IDOR).
9. **Index Query Patterns**: Add compound and unique indexes based on actual query patterns (e.g. `{ eventId: 1, sequenceNumber: 1 }`, `{ verificationToken: 1 }`).
10. **Audit Logging for Mutations**: Sensitive operations (staff invitations, score overrides, event suspensions, role assignments) MUST write an immutable audit log entry.
11. **Enforce Idempotency**: Design mutation endpoints (payment webhooks, check-ins, invitation acceptances) to be idempotent and safe to retry.
12. **Defend Against Race Conditions**: Check-in endpoints must use atomic conditional updates (`findOneAndUpdate` with `{ status: 'ACTIVE' }`) to guarantee that simultaneous scans cannot both succeed.
13. **Optimize Storage & Bandwidth**: Never proxy large file downloads or uploads through Node memory when direct presigned object storage URLs are practical.
14. **Update Documentation Continuously**: Whenever an architectural change is made, update the relevant documentation files and record an ADR in `DECISION.md`.
15. **Never Silently Change Source-of-Truth Decisions**: Keep all documents synchronized and mutually consistent.

---

## 5. Domain Skills Map (`.agents/skills/`)
Before performing domain-specific work, invoke the corresponding skill:
- **`frontend-design`**: Context-aware UI, dark theme palette, color rules, layout hierarchy.
- **`frontend-engineering`**: React 18, Vite, component separation, API clients.
- **`backend-engineering`**: Layered architecture, controllers, services, repositories.
- **`supabase-engineering`**: Supabase Auth (JWT validation) & Supabase Storage (presigned URLs).
- **`security-engineering`**: Zero-trust authorization, RBAC, IDOR prevention, token security, upload sanitization.
- **`testing-engineering`**: Test pyramids, unit/integration/E2E tests, concurrency regression tests.
- **`ticket-system`**: Credential abstraction, Sharp rasterization, QR token generation, atomic check-in.

---

## 6. Legacy Code & Data Preservation
Treat existing code as `LEGACY / UNTRUSTED IMPLEMENTATION`. Code may be refactored or replaced in accordance with the 22-phase plan, but existing user data, Auth users, PostgreSQL records, and Supabase Storage assets MUST be strictly preserved.
