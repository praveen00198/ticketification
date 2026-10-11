# PHASE 17 AUDIT: Storage + Performance Optimization

## 1. Executive Summary
Phase 17 delivers comprehensive **Storage + Performance Optimization** for the Ticketification Event Operating Platform. Operating on cost-effective infrastructure (such as Render 512MB RAM Linux containers and Supabase Storage free/pro tiers), the platform must maintain rock-solid memory stability, deterministic complex script typography (Devanagari/Indic), and proactive storage quota governance.

---

## 2. Architectural Objectives

### 2.1 Render 512MB RAM Optimization & Native Sharp Tuning
- Enforce `sharp.cache(false)` and `sharp.concurrency(1)` to eliminate native libvips buffer retention outside the V8 heap.
- Introduce `MemoryBudgetGovernor` to monitor process RSS against a 400MB threshold (leaving 112MB headroom).
- Eliminate high-risk headless browser fallbacks that trigger out-of-memory container crashes.
- Bounded batch processing (chunks of 2) across all background credential generation queues.

### 2.2 Deterministic Devanagari & Indic Complex Font Shaping
- Embed bundled Google `NotoSansDevanagari-Bold.ttf` directly as base64 inside SVG templates via `@font-face` in `EventCredentialRenderingService`.
- Ensure Pango and HarfBuzz resolve complex Hindi, Sanskrit, and Marathi conjuncts (`क्ष`, `त्र`, `ज्ञ`, `श्र`, `|| श्री गणेशाय नमः ||`) deterministically with zero broken glyphs or network dependencies.
- Include `'Noto Sans Devanagari'` in the typography fallback cascade across all credential field templates.

### 2.3 Storage Quota Governance & Lifecycle Policies
- Provide transparent per-event storage usage metrics and breakdowns (Credentials, Exports, Templates).
- Enforce standard 1024MB (1GB) event quota boundaries to prevent runaway disk allocations and upstream billing spikes.
- Automated and on-demand stale export cleanup (`cleanupStaleExports`) deleting temporary ZIP/XLSX/CSV archives older than 24 hours to reclaim storage quota.
- Zero-Trust RBAC: Storage metrics and cleanup operations are strictly restricted to verified Hosts and Coordinators via MongoDB `event_members`.

---

## 3. Layered Implementation Specification

```
[HTTP Request]
       │
       ▼
[event-storage.routes.ts] ──► authenticateJwt + requireEventRole(['HOST', 'COORDINATOR'])
       │
       ▼
[event-storage.controller.ts]
       │
       ▼
[event-storage-governance.service.ts]
       ├──► [SupabaseStorageService] (listFolder, deleteFiles, getBreakdown)
       ├──► [MemoryBudgetGovernor] (monitor RSS, enforce 400MB threshold)
       └──► [EventCredentialRenderingService] (base64 NotoSansDevanagari font embedding)
```

---

## 4. Verification & Testing Strategy
- Unit & integration tests for Devanagari text shaping and `@font-face` embedding.
- Memory budget monitoring and Sharp tuning assertion tests.
- Storage quota calculation, breakdown, and stale export deletion tests.
- Zero-Trust RBAC security tests for storage management endpoints.
- Full regression run of all 29 existing test suites.
- Production builds on both client and server.
