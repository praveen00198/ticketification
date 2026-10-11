# PHASE 5 PRE-IMPLEMENTATION AUDIT & ARCHITECTURAL PLAN
## Event Verification, Institutional Email + OTP, Document Upload & Risk Review Engine

**Phase:** Phase 5  
**Objective:** Deliver an end-to-end, zero-trust Event Verification engine allowing event hosts to verify institutional affiliations via official domain email + OTP, submit authorization documents to Supabase Storage, calculate automated risk tiers (Low / Medium / High), and permit Platform Administrators to review and approve/reject verification requests.

---

## 1. Prerequisites Verification
1. **Global Identity & Organizer Workspace (Phase 3)**:
   - Verified: All hosts possess an active MongoDB user record and initialized workspace (`workspaceStatus === 'ACTIVE'`).
2. **Canonical Event Model (Phase 4)**:
   - Verified: Events are canonically stored in MongoDB with `ownerId`, `ownerSupabaseId`, `status: 'DRAFT'`, `schedule`, `venue`, and `registration`.
3. **Platform Role Isolation**:
   - Verified: Normal hosts remain `platformRole: 'USER'`. Platform admins (`ADMIN`, `SUPER_ADMIN`) are authorized to review verification requests via `requireAdmin` middleware.
4. **Supabase Storage Integration**:
   - Verified: Bucket storage service operational for assets and banners; ready to support `events/{eventId}/verification/{filename}` for PDF and image documents.

---

## 2. Component Classification
| Component | Classification | Notes |
|---|---|---|
| `server/src/db/mongo/models/event.model.ts` | **MODIFY** | Add `verificationStatus` and `verificationLevel` to `IEvent` |
| `server/src/db/mongo/models/event-verification.model.ts` | **CREATE** | Canonical schema for `event_verifications` collection |
| `server/src/modules/events/repositories/mongo-event-verification.repository.ts` | **CREATE** | MongoDB repository for verification CRUD and admin queries |
| `server/src/modules/events/services/event-verification.service.ts` | **CREATE** | Risk calculation engine, OTP generation/validation, submit & review workflows |
| `server/src/modules/events/controllers/event-verification.controller.ts` | **CREATE** | HTTP handlers for host verification flow and admin review |
| `server/src/modules/events/routes/event-verification.routes.ts` | **CREATE** | Host routes mounted on `/api/events/:eventId/verification` & Admin routes on `/api/admin/verifications` |
| `server/src/modules/tickets/services/supabase-storage.service.ts` | **MODIFY** | Add `uploadVerificationDocument` for PDF/PNG/JPEG validation & storage |
| `server/tests/eventVerification.test.ts` | **CREATE** | Comprehensive test suite for OTP, risk scoring, document upload, IDOR, and admin review |
| `client/src/api/events.ts` | **MODIFY** | Add verification API client methods (`sendOtp`, `verifyOtp`, `uploadDocument`, `submitVerification`, `getVerification`) |
| `client/src/components/events/EventVerificationCard.tsx` | **CREATE** | Interactive verification component with OTP input, document dropzone, and risk tier badge |
| `client/src/pages/EventDetailPage.tsx` | **MODIFY** | Integrate verification card and status indicators |

---

## 3. Risk-Scoring Heuristics (PRD Section 5.2 Alignment)
The automated risk engine assigns a score ($S \in [0, 100]$):
- **Base Pricing Intent**:
  - `PAID` event: $+40$ points
  - `FREE` event: $0$ points
- **Expected Capacity**:
  - Capacity $> 2000$: $+30$ points
  - Capacity $200 - 2000$: $+15$ points
  - Capacity $< 200$: $0$ points
- **Institutional Email & Domain Verification**:
  - OTP Verified on Institutional/Academic Domain (not Gmail/Yahoo/Hotmail/Outlook): $-20$ points
  - Public webmail domain or unverified OTP: $+20$ points
- **Authorization Documents**:
  - At least 1 valid authorization document uploaded: $-15$ points
  - No documents uploaded: $+25$ points

**Risk Tier Mapping**:
- $S < 25 \implies$ **`LOW` Risk** (Free events, verified institutional host, capacity $< 200$, eligible for expedited review).
- $25 \le S \le 60 \implies$ **`MEDIUM` Risk** (Free event with capacity $200 - 2000$ or unverified domain).
- $S > 60 \implies$ **`HIGH` Risk** (Paid event, capacity $> 2000$, or high financial/fraud risk; mandatory manual review and document verification before tickets go on sale).

---

## 4. Security Invariants
1. **Zero-Trust Event Ownership**: Only the verified owner (`req.user.id === event.ownerId`) can view, submit, or upload documents for an event's verification.
2. **Admin Isolation**: Only `ADMIN` or `SUPER_ADMIN` can review or transition verification states (`requireAdmin` middleware).
3. **Cryptographic OTP Security**:
   - 6-digit numeric OTP generated via `crypto.randomInt(100000, 999999)`.
   - Stored hashed via SHA-256 (`otpHash`) with a 10-minute expiry (`otpExpiresAt`).
   - Constant-time string comparison prevents timing attacks.
4. **File Upload Hardening**:
   - Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`.
   - Maximum file size: $10\text{ MB}$.
   - Stored under isolated path: `events/{eventId}/verification/{timestamp}_{sanitizedFilename}`.
