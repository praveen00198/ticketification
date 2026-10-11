# WhatsApp Business Cloud API Integration Guide (DEFERRED / FUTURE SCOPE)

> [!WARNING]
> **Status: DEFERRED / FUTURE SCOPE**
> In accordance with ADR-010 and the current product focus on the **Host Platform (Phases 1–19)**, all third-party messaging delivery integrations (WhatsApp Cloud API, SMS, external delivery providers) are **DEFERRED**.
> The platform currently distributes credentials via direct individual download and asynchronous ZIP archives.
> This document is retained for architectural reference when automated messaging pipelines are scheduled in future phases.

---

## 1. Architectural Concept
When messaging delivery is re-introduced, it will operate as an asynchronous background worker downstream of credential generation:

```
[Credential Generated & Stored in Supabase Storage]
                      │
                      ▼
            [Notification Job Queue]
                      │
                      ▼
          [WhatsApp Cloud API Worker]
                      │
                      ▼
               [Guest Device]
```

## 2. Technical Invariants for Future Implementation
1. **Presigned Storage URLs**: Images delivered via WhatsApp must reference Supabase Storage CDN URLs, never local server disk paths (`/uploads/`).
2. **Asynchronous Batches**: Bulk messaging must process in controlled batches with rate limit governors to avoid Meta API quota throttling.
3. **Template Verification**: Templates must be pre-approved in Meta Business Manager.
