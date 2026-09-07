# AGENTS.md — Permanent Project Rules & Engineering Governance

## 1. Project Purpose
Ticketification is a production-oriented event ticket generation and QR verification platform. It allows event administrators to register/login, create events, import categorized guest lists from Excel with dynamic header mapping, generate cryptographically verified high-resolution PNG tickets with embedded QR codes, upload assets to Supabase Storage, download tickets individually or in bulk ZIP archives, and scan/verify QR tickets on event day with server-enforced atomic single-use and reusable worker check-in policies.

---

## 2. Engineering Governance & Sources of Truth
The following documentation files in the project root constitute the engineering source of truth:
1. `PRD.md` — Product Requirements Document
2. `ARCHITECTURE.md` — System Architecture & Layered Boundaries
3. `RULES.md` — Non-negotiable Engineering Rules & Invariants
4. `PHASES.md` — Phase Definitions & Completion Criteria
5. `DESIGN.md` — Design System & Visual Specification
6. `MEMORY.md` — Operational Knowledge & Audit Discoveries
7. `AGENTS.md` — Agent Guidelines & Invariants (this file)
8. `DECISION.md` — Architecture Decision Records (ADRs)
9. `TESTING.md` — Test Strategy & Verification Matrix

Requirements must never exist solely inside chat messages.

---

## 3. Mandatory Agent Workflow (13-Step Cycle)
Whenever any task or modification is requested:
1. **Read project documentation first** (`PRD.md`, `ARCHITECTURE.md`, `RULES.md`, etc.).
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
Agents MUST NOT:
- Rewrite unrelated code or refactor outside the approved task scope.
- Introduce unnecessary dependencies (e.g. Redis, BullMQ, Kafka, microservices).
- Bypass the layered architecture (e.g. calling `db` from a service or controller).
- Create duplicate or competing implementations (`verifyV2`, `ticketNew`, etc.).
- Make silent fallbacks (e.g. saving locally when Supabase fails, or serving SVG as PNG).
- Delete Supabase Auth users, database tables, or Supabase Storage objects.
- Change the design system or introduce random purple/violet/indigo colors.
- Claim completion without running type checking, build, and test verification.

---

## 5. Domain Skills Map (`.agents/skills/`)
Before performing domain-specific work, invoke the corresponding skill:
- **`frontend-design`**: Visual tokens, dark theme palette, color rules, layout hierarchy.
- **`frontend-engineering`**: React 18, Vite, component separation, API clients.
- **`backend-engineering`**: Layered architecture, controllers, services, repositories.
- **`supabase-engineering`**: PostgreSQL, Drizzle ORM, Supabase Auth & Storage.
- **`security-engineering`**: IDOR prevention, token security, upload sanitization, secrets.
- **`testing-engineering`**: Test pyramids, unit/integration/E2E tests, regression prevention.
- **`ticket-system`**: PNG rendering, QR token generation, atomic check-in, worker flows.

---

## 6. Legacy Code & Data Preservation
Treat existing code as `LEGACY / UNTRUSTED IMPLEMENTATION`. Code may be refactored or replaced in accordance with the phased plan, but existing user data, Auth users, PostgreSQL records, and Supabase Storage assets MUST be strictly preserved.
