# Architectural Decisions Log

## Decision 001: PostgreSQL (Supabase) over MongoDB
- **Decision**: Use Supabase PostgreSQL as the primary database.
- **Reason**: Relational model naturally fits event→ticket→check-in relationships. Foreign keys, unique constraints, and transactional atomicity are critical for check-in race conditions. Previous MongoDB implementation had ordering issues.
- **Alternative**: MongoDB (Mongoose) — rejected due to ordering issues experienced in prior implementation and lack of relational constraints for this use case.
- **Consequence**: Entire persistence layer rebuilt. All Mongoose models replaced with Drizzle ORM schemas.

## Decision 002: Drizzle ORM over raw SQL / Prisma
- **Decision**: Use Drizzle ORM for database interactions.
- **Reason**: TypeScript-native, SQL-like syntax keeps queries readable and explicit (important for ORDER BY discipline). Lightweight with no code generation step. Works natively with Supabase PostgreSQL.
- **Alternative 1**: Prisma — heavier, requires code generation step, abstracts away SQL more than desired.
- **Alternative 2**: Raw SQL — error-prone, no type safety, harder to maintain.
- **Alternative 3**: Knex.js — query builder only, less type safety than Drizzle.
- **Consequence**: All repository methods use Drizzle query builder. Schema defined as TypeScript code.

## Decision 003: Explicit ORDER BY on all queries
- **Decision**: Every query returning ordered results MUST include an explicit ORDER BY clause.
- **Reason**: Previous MongoDB implementation experienced issues with implicit ordering. PostgreSQL does NOT guarantee any particular order without ORDER BY. This is a non-negotiable reliability requirement.
- **Consequence**: Enforced in all repository methods. Documented in AGENTS.md and database-schema.md.

## Decision 004: Supabase Auth over custom JWT+bcrypt
- **Decision**: Use Supabase Auth for authentication (email/password registration, login, JWT).
- **Reason**: Eliminates need for bcryptjs, jsonwebtoken, and custom password handling. Integrates with Supabase RLS. Provides session management out of the box.
- **Alternative**: Custom JWT + bcrypt — more code to maintain, potential security gaps, no integration with Supabase RLS.
- **Consequence**: Auth middleware validates Supabase JWT tokens. No custom password hashing.

## Decision 005: Separate ticket_checkins table
- **Decision**: Use a dedicated `ticket_checkins` table for check-in history.
- **Reason**: Worker tickets can check in multiple times. A single `usedAt` timestamp on the ticket record loses audit history. This table provides a complete, ordered log of all check-in events.
- **Alternative**: Single `usedAt` field — insufficient for reusable worker tickets.
- **Consequence**: Every check-in creates a new row in `ticket_checkins`.

## Decision 006: usage_policy as a ticket-level field
- **Decision**: Store `usage_policy` (`SINGLE_USE` / `REUSABLE`) on both `ticket_types` and `tickets` tables.
- **Reason**: Enables extensible ticket categories without code changes. New types (SPEAKER, MEDIA) can be added with their own policy. Denormalized on tickets for fast verification without joins.
- **Consequence**: Adding new ticket categories requires no code changes, only database configuration.

## Decision 007: No user-facing Ticket ID
- **Decision**: Do not display a Ticket ID on generated ticket images.
- **Reason**: The verification token (opaque, cryptographically secure) is the only credential. No sequential IDs exposed to prevent enumeration attacks.
- **Consequence**: Ticket images contain only QR code, guest name, and event branding.

## Decision 008: Atomic check-in via conditional SQL
- **Decision**: Single-use check-in uses `UPDATE tickets SET status='USED' WHERE id=$1 AND status='ACTIVE' RETURNING *`.
- **Reason**: PostgreSQL guarantees exactly one concurrent transaction succeeds with this pattern. Prevents race condition where two scanners simultaneously check in the same ticket.
- **Alternative**: SELECT → application check → UPDATE — vulnerable to race conditions.
- **Consequence**: Check-in endpoint returns success/failure based on affected row count.

## Decision 009: Supabase Storage for ticket assets
- **Decision**: Store generated ticket images in Supabase Storage, not as base64 in database.
- **Reason**: Previous implementation stored full base64 images in MongoDB documents (500KB–2MB each). This is an anti-pattern that bloats the database and degrades query performance.
- **Consequence**: Ticket images stored at `tickets/<event-id>/<ticket-uuid>.png`. Only the storage path is stored in the database.

## Decision 010: Remove all delivery integrations
- **Decision**: Remove WhatsApp, email, and all delivery provider code.
- **Reason**: Out of scope for current MVP. Can be re-added as a separate phase.
- **Consequence**: No delivery module, no webhook routes, no email/WhatsApp provider code.

## Decision 011: Remix Icon over Lucide React
- **Decision**: Use Remix Icon for the icon system.
- **Reason**: Explicit requirement. Consistent visual language. Single icon library prevents mixed styles.
- **Consequence**: Remove lucide-react dependency, add remixicon CSS.

## Decision 012: Enforce Canonical Supabase Storage Pipeline & Remove Ephemeral Render Storage
- **Decision**: Eliminate local disk writes and ephemeral Render filesystem URLs (`/uploads/...`) for ticket assets. All generated ticket SVGs must be uploaded directly to Supabase Storage before database records are inserted.
- **Reason**: Render containers have ephemeral storage; tickets saved to disk were erased on spin-down/restart, causing 404s. The Supabase upload errors were previously swallowed, creating tickets with broken Render URLs while leaving the Supabase bucket empty.
- **Consequence**:
  1. `TicketImageService` generates vector SVGs purely in-memory with zero local disk writes.
  2. `SupabaseStorageService` uploads assets with upsert to `events/<eventId>/tickets/ticket-<displayId>.svg` and throws explicit `AppError` on any failure.
  3. `TicketService` mandates verified Supabase Storage uploads before database insertion, guaranteeing 100% asset availability.
  4. Removed `/uploads/tickets/` on-demand local regeneration and static serving middleware from Express `app.ts`.

## Decision 013: Bulk Ticket ZIP Streaming directly from Supabase Storage
- **Decision**: Stream ticket files directly from the Supabase Storage bucket (`ticket-images`) into a client-downloadable ZIP archive (`<Event-Name>-Tickets.zip`) using batch streaming (chunks of 20), safe filename deduplication, and an embedded CSV manifest.
- **Reason**: Previous implementation attempted to read local files from `/uploads` which do not exist on ephemeral cloud hosting. Additionally, loading thousands of image buffers in memory simultaneously risked out-of-memory crashes on Node.js.
- **Consequence**: `TicketService.streamTicketsZip()` streams tickets in chunks, queries Supabase Storage via `downloadTicketImage()`, sanitizes guest filenames (`<Name>.svg`, `<Name>-2.svg`), and includes `tickets-manifest.csv`.

## Decision 014: Authoritative Single-Step Atomic QR Scan & Check-In
- **Decision**: Provide a unified `POST /api/verify/scan` endpoint that performs verification and atomic check-in in a single transaction on the server, eliminating the manual "Checked In" button and scrolling overhead in the mobile scanner UI.
- **Reason**: The two-step flow (`/verify/lookup` -> user scrolls and taps "Checked In" button -> `/verify/checkin`) slowed down event entrance operations and created race conditions with delayed check-ins.
- **Consequence**: Scanning a QR code immediately checks in the guest on the server (using atomic conditional SQL for single-use tickets), returns the result instantly, and updates the mobile scanner UI in-place above the fold.


