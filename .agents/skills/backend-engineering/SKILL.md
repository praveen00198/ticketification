---
name: backend-engineering
description: Strict layered architecture rules, repository boundaries, and service orchestration for Node.js / Express / TypeScript / Drizzle ORM.
---

# Backend Engineering Skill — Ticketification

## Purpose
Enforces the mandatory layered architecture for the Node.js / Express / TypeScript backend, preventing architectural drift, leaky abstractions, and god-files.

## Layered Flow (MANDATORY)
Every backend operation MUST flow strictly down the following layers:

```
HTTP REQUEST
   │
   ▼
[1. ROUTE LAYER]            (Endpoint definition, auth & validation middleware)
   │
   ▼
[2. CONTROLLER LAYER]       (Request parsing, DTO binding, HTTP response mapping)
   │
   ▼
[3. SERVICE LAYER]          (Domain rules, transaction orchestration, workflows)
   │
   ▼
[4. REPOSITORY LAYER]       (Drizzle ORM queries, explicit SQL operations)
   │
   ▼
[5. DATABASE / STORAGE]     (Supabase PostgreSQL & Supabase Storage)
```

## Responsibilities & Boundary Constraints

### 1. Route Layer (`*.routes.ts`)
- **Allowed**: Route paths, HTTP verbs, middleware attachment (`authMiddleware`, request validation).
- **Forbidden**: Business logic, database queries, Drizzle calls, image rendering, error generation logic.

### 2. Controller Layer (`*.controller.ts`)
- **Allowed**: Reading `req.params`, `req.query`, `req.body`, `req.user`; passing typed inputs to service methods; sending `res.status(...).json(...)` or streaming file responses; passing errors to `next(err)`.
- **Forbidden**: Direct database calls, importing Drizzle `db`, file uploads to storage, business decisions.

### 3. Service Layer (`*.service.ts`)
- **Allowed**: Business validation, coordinating repositories, coordinating adapters/providers (e.g., `TicketImageService`, `StorageService`), orchestrating transactions, enforcing event ownership and usage rules.
- **Forbidden**: Direct SQL execution or `db.select()`/`db.update()` calls (must delegate to Repositories), Express HTTP objects (`req`, `res`, `next`).

### 4. Repository Layer (`*.repository.ts`)
- **Allowed**: Drizzle ORM queries (`db.select()`, `db.insert()`, `db.update()`), transaction execution, parameter binding, returning domain objects.
- **Rule**: ALL order-sensitive queries MUST specify explicit `ORDER BY`. Never rely on natural table order.
- **Forbidden**: HTTP concepts, presentation formatting, external network requests.

### 5. Infrastructure Provider Layer (`*.provider.ts` / `storage.service.ts`)
- Isolates external SDKs (Supabase Storage, Puppeteer, XLSX).
- Exposes clear interfaces so infrastructure changes do not break business domains.

## Common Mistakes to Avoid
- Calling `db.update()` or `db.select()` directly from a service file instead of the repository.
- Swallowing errors in `catch` blocks or falling back silently to fake states.
- Running unmetered `Promise.all` across thousands of items. Always batch or stream large operations.
- Mounting competing endpoints for the same domain across multiple route files.

## Verification Checklist
- [ ] No `db` imports in services or controllers.
- [ ] Explicit `ORDER BY` on every query returning lists.
- [ ] All inputs validated before reaching business services.
- [ ] Backend builds without errors (`npm run build` in `server/`).
