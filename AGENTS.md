# AGENTS.md — Permanent Project Rules & Guidelines

## Project Purpose
QR Ticket Generation & Verification Platform — a production-quality event ticketing console for administrators to register/login, create events, import categorized guest lists from Excel, generate cryptographically verified image/QR tickets, download tickets individually or in bulk, and scan/verify QR tickets on event day with proper check-in enforcement.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Drizzle ORM, Supabase (PostgreSQL + Auth + Storage), Puppeteer, `qrcode`.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, `html5-qrcode`, Remix Icon.
- **Database**: Supabase PostgreSQL (relational modeling, foreign keys, constraints, indexes).
- **ORM**: Drizzle ORM (TypeScript-native, SQL-like, explicit queries).
- **Storage**: Supabase Storage (event-scoped ticket image assets).
- **Auth**: Supabase Auth (email/password, JWT validation).

## Context-First Development
1. **Read `PROJECT_CONTEXT.md` before starting any task.**
2. Read relevant `docs/*` files before modifying architecture.
3. Never blindly scan the entire repository if context docs contain the required information.
4. **Update `PROJECT_CONTEXT.md` after significant changes.**
5. Never change architecture without documenting the decision in `docs/decisions.md`.

## Non-Negotiable Database Rules
1. **ALL order-sensitive queries MUST use explicit `ORDER BY`**. Never rely on implicit database ordering, natural order, physical storage order, or query planner order.
2. Use Drizzle ORM for all database interactions. No raw SQL unless absolutely necessary.
3. Use proper relational modeling: foreign keys, unique constraints, check constraints, indexes.
4. Use database transactions where atomicity is required (e.g., check-in operations).
5. Store missing/optional data as `NULL`, never as placeholder values (`"N/A"`, `"0000000000"`).

## Architecture Constraints
- Modular monolith pattern: routes → controllers → services → repositories.
- **Controller**: HTTP concerns only. No business logic, no DB queries.
- **Service**: Business logic. No HTTP response handling, no direct DB queries.
- **Repository**: Database interaction via Drizzle ORM. No business decisions.
- QR code verification and check-in status checks must be evaluated exclusively server-side.
- QR payload contains secure token URL (`https://APP_DOMAIN/verify/<SECURE_TOKEN>`), never raw personal details.
- Atomic check-in for single-use tickets via conditional SQL update.

## Environment & Secrets Rules
1. Never commit actual secret keys (`SUPABASE_SERVICE_ROLE_KEY`, Supabase URL/keys) to Git.
2. Track `.env.example` templates in root, `server/`, and `client/`.
3. Backend configuration must be accessed strictly through `config.env` from `server/src/config/env.ts`.
4. Frontend environment variables must use `VITE_` prefix and never expose private server credentials.
5. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.**

## Out of Scope (Current Version)
- Email delivery (Resend, SES, SMTP)
- WhatsApp delivery (Meta Cloud API)
- Any third-party messaging integration

## Development Rules
1. Never introduce dependencies without justification.
2. Never bypass authorization — server-side enforcement always.
3. Never break existing business rules without documenting the change.
4. Run TypeScript type checking after changes.
5. Run production build verification before declaring work complete.
6. Review affected files before marking tasks complete.

## Relevant Context Files
- [PROJECT_CONTEXT.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/PROJECT_CONTEXT.md)
- [docs/architecture.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/architecture.md)
- [docs/data-flow.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/data-flow.md)
- [docs/api-contracts.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/api-contracts.md)
- [docs/database-schema.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/database-schema.md)
- [docs/design-system.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/design-system.md)
- [docs/ticket-engine.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/ticket-engine.md)
- [docs/verification-rules.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/verification-rules.md)
- [docs/decisions.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/decisions.md)
