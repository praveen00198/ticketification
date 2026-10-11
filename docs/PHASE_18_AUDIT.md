# PHASE 18 AUDIT: Security + Audit + Reliability

## 1. Executive Summary
Phase 18 implements the complete **Security + Audit + Reliability** architecture for Ticketification. It establishes an immutable administrative audit log ledger (`audit_logs`), distributed token-bucket rate limiting with burst governors, proactive abuse and anomaly detection, and end-to-end security regression verification.

---

## 2. Core Deliverables

### 2.1 Immutable Audit Log Ledger (`audit_logs`)
- MongoDB model with schema-level write-once enforcement (disallowing updates and deletes).
- Fields: `actorId`, `actorEmail`, `actorRole`, `eventId`, `action`, `targetEntity`, `targetId`, `metadata`, `ipAddress`, `userAgent`, `createdAt`.
- Compound indexes for efficient event-scoped filtering: `{ eventId: 1, createdAt: -1 }`, `{ actorId: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`.
- Mutation hooks capturing:
  - Staff invitations, role assignments, and removals
  - Credential revocations and status modifications
  - Lifecycle state changes (e.g. `EVENT_LIVE`, `SUSPENDED`)
  - Storage purges and heavy export generation triggers

### 2.2 Advanced Rate Limiting & Abuse Detection
- Token-bucket sliding window rate limiters with endpoint awareness:
  - Auth: 30 req/15min
  - QR Scanner: 180 req/min (high-throughput turnstile check-in)
  - Export Queue: 5 req/min (avoids heavy job spamming)
  - Public Verification: 60 req/min
- Anomaly detector logging security warnings on burst rate limit breaches or repeated 403 Forbidden events.

### 2.3 Layered RBAC Query Boundary
- `GET /api/events/:eventId/audit-logs`:
  - Zero-Trust event member check: only `HOST` and platform `ADMIN` / `SUPER_ADMIN` can inspect event audit history.
  - Strict `{ eventId }` scoping preventing cross-event IDOR leaks.

---

## 3. Architecture & Data Flow

```
[Incoming Request]
       │
       ▼
[RateLimiter Middleware] ──► (Track token bucket by IP/Actor)
       │
       ▼
[Route & Controller] ──► Authenticate + Verify Event RBAC ('HOST')
       │
       ▼
[Business Service] ──► Perform Action
       │
       ▼
[AuditService] ──► Write immutable document to Mongo `audit_logs`
```
