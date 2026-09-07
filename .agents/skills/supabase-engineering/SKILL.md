---
name: supabase-engineering
description: Guidelines for Supabase PostgreSQL, Auth, Storage, migrations, and Drizzle ORM integration.
---

# Supabase Engineering Skill — Ticketification

## Purpose
Governs interactions with Supabase (PostgreSQL, Supabase Auth, and Supabase Storage), ensuring security, data preservation, and clean schema migrations.

## When to Use
- Interacting with Supabase Auth, JWT verification, and user sessions.
- Managing database migrations with Drizzle Kit.
- Uploading, retrieving, or checking ticket assets in Supabase Storage.
- Enforcing Row Level Security (RLS) or server-side service-role isolation.

## Data Preservation Mandate
> [!CAUTION]
> Treat existing data as strictly PRESERVED:
> - NEVER drop tables or run destructive database resets (`drizzle-kit push --force` or raw `DROP TABLE`).
> - NEVER delete Supabase Auth users.
> - NEVER delete existing Supabase Storage ticket objects.
> - Preserve all existing events, guests, tickets, and check-in records.

## Database Guidelines (Drizzle ORM + PostgreSQL)
1. **Explicit Queries**: Use Drizzle ORM query builders. All table queries returning lists must include `.orderBy(...)`.
2. **Relational Constraints**: Enforce foreign keys, unique constraints (e.g. `(event_id, sequence_number)`), and indexes (`idx_tickets_verification_token`).
3. **Missing Data**: Use `NULL` for missing optional values. Never use placeholder strings like `"N/A"`, `"-"`, or `"0000000000"`.
4. **Transactions**: Use `db.transaction(async (tx) => { ... })` for multi-step mutations (such as guest import or worker name assignment + check-in).

## Supabase Storage Governance
1. **Target Bucket**: `ticket-images`
2. **Canonical Asset Path**: `events/{eventId}/tickets/{filename}.png`
3. **Format**: Real binary PNG only (MIME: `image/png`). Never SVG, JPEG, or renamed extensions.
4. **Storage Abstraction**: All storage interactions must go through the dedicated `StorageService` / `SupabaseStorageProvider`. Never instantiate `supabase.storage.from()` in random files.
5. **Failure Policy**: If upload to Supabase Storage fails, fail the request. Never save locally and claim success. Never return a fake public URL.

## Security & Secrets
- `SUPABASE_SERVICE_ROLE_KEY` must remain strictly server-side. Never expose it in client bundles or frontend `.env`.
- Frontend uses `VITE_SUPABASE_ANON_KEY` exclusively for client-side Auth session management.
- Backend configuration must be loaded via `config.env` from `server/src/config/env.ts`.

## Verification Checklist
- [ ] No client access to `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Uploaded objects verified as PNG before storing metadata.
- [ ] No raw `DROP TABLE` or destructive database schema commands.
