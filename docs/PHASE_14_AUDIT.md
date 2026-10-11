# Phase 14 Audit & Implementation Plan — QR Verification + Atomic Check-in

## 1. Domain Overview & Mission
Phase 14 implements high-throughput, race-condition-proof Day-of-Event Credential Verification and Atomic Check-In for Ticketification's generic credential architecture (`event_credentials`).

### Key Objectives
1. **Atomic Check-in Invariant (RULES.md Section 5.1 & Invariant 12)**:
   - For `SINGLE_USE` credentials, check-in must execute via a single conditional atomic update:
     ```text
     findOneAndUpdate(
       { _id: credentialId, eventId, status: 'ACTIVE' },
       { $set: { status: 'CHECKED_IN', firstCheckedInAt: new Date(), lastCheckedInAt: new Date() }, $inc: { checkInCount: 1 } },
       { new: true }
     )
     ```
   - Two scanners scanning the same single-use credential at the exact same millisecond: **exactly one succeeds** (`SUCCESS`); the other fails with `ALREADY_CHECKED_IN` and returns the exact timestamp of the first check-in.
2. **Reusable & Worker Pass Workflows (PRD.md 9.2)**:
   - For `REUSABLE` or `REUSABLE_WORKER` credentials:
     - Multiple entries are permitted.
     - Each entry atomically increments `checkInCount: { $inc: { checkInCount: 1 } }` and sets `lastCheckedInAt: new Date()`.
     - First scan for an unassigned worker (`holder.isAssigned === false` or unassigned worker name) assigns worker identity on-site and marks `holder.isAssigned = true`.
3. **Immutable Check-in Log (`event_credential_checkins`)**:
   - Every scan attempt (both successful and failed duplicates/revoked) is logged with:
     - `eventId`: ObjectId
     - `credentialId`: ObjectId
     - `scannedBy`: ObjectId (staff user)
     - `scannedAt`: Date
     - `scanStatus`: `'SUCCESS' | 'ALREADY_CHECKED_IN' | 'REVOKED' | 'EXPIRED' | 'UNASSIGNED_PROMPT'`
     - `gate`: String (e.g. 'Main Gate')
     - `holderSnapshot`: `{ name, category, formattedId }`
     - `deviceInfo` / `notes`: Optional
4. **RBAC & Zero-Trust Authorization**:
   - Scanner staff must be verified via MongoDB `event_members`.
   - Permitted roles: `HOST`, `COORDINATOR`, or `VOLUNTEER` with `SCAN_CREDENTIALS` or `ALL` permissions.
   - Non-members or unauthorized volunteers receive `403 Forbidden`.
5. **Real-time Metrics & Live Feeds**:
   - Live check-in stream endpoint `GET /api/events/:eventId/credentials/checkins` (with pagination/search/gate filters).
   - Live velocity metrics `GET /api/events/:eventId/credentials/checkin-stats` (active rate, velocity in last 15 min, breakdown by category).
6. **Frontend Day-of-Event Scanner UI**:
   - Web camera scanner with html5-qrcode fallback and manual 64-character token lookup.
   - Emerald / Rose / Amber alert chime feedback.
   - Unassigned worker assignment modal.
   - Live check-in log stream card with gate selector.

---

## 2. Technical Architecture & File Plan

### Backend Files to Create/Update
1. **Model**: `server/src/db/mongo/models/event-credential-checkin.model.ts`
   - Schema for `event_credential_checkins` with indexes on `{ eventId: 1, scannedAt: -1 }` and `{ credentialId: 1, scannedAt: -1 }`.
2. **Repository**: `server/src/modules/events/repositories/mongo-event-credential-checkin.repository.ts`
   - `createCheckinLog(data)`
   - `findRecentByEvent(eventId, filters, limit)`
   - `getCheckinStats(eventId)`
3. **Repository Extension**: `server/src/modules/events/repositories/mongo-event-credential.repository.ts`
   - Atomic conditional check-in methods:
     - `atomicCheckInSingleUse(eventId, credentialId)`
     - `atomicCheckInReusable(eventId, credentialId, workerName?)`
4. **Service**: `server/src/modules/events/services/event-credential-checkin.service.ts`
   - Authorization guard (verifies scanner is Host/Coordinator/Volunteer with scan permission).
   - Atomic scan dispatch based on `usagePolicy`.
   - Worker on-the-fly assignment.
   - Audit logging to `event_credential_checkins`.
   - Aggregated stats and velocity calculation.
5. **Controller**: `server/src/modules/events/controllers/event-credential-checkin.controller.ts`
   - `verifyAndCheckIn`: `POST /api/events/:eventId/credentials/checkin`
   - `listCheckinLogs`: `GET /api/events/:eventId/credentials/checkins`
   - `getCheckinStats`: `GET /api/events/:eventId/credentials/checkin-stats`
6. **Routes**: `server/src/modules/events/routes/event-credential-checkin.routes.ts`
   - Mounted into `event.routes.ts` at `/:eventId/credential-checkin`.
7. **Automated Test Suite**: `server/tests/credentialAtomicCheckin.test.ts`
   - Atomic single-use check-in verification.
   - Race condition defense: simultaneous scans yielding exactly 1 success and 1 `ALREADY_CHECKED_IN`.
   - Reusable worker pass multiple entries and auto-assignment.
   - Revoked pass rejection.
   - Staff RBAC verification (Host, Coordinator, Volunteer with SCAN permission vs without).
   - Live metrics and log streams.

### Frontend Files to Create/Update
1. **API Client**: `client/src/api/events.ts`
   - Add Phase 14 interfaces: `CredentialCheckinLog`, `CredentialCheckinStats`, `CheckinRequest`, `CheckinResponse`.
   - Add API methods: `checkInCredential`, `getCredentialCheckins`, `getCredentialCheckinStats`.
2. **Component**: `client/src/components/events/EventCheckinScannerCard.tsx`
   - QR Scanner modal with camera or manual input.
   - Real-time sound/color alerts (Emerald `#10b981`, Rose `#f43f5e`, Amber `#f59e0b`).
   - Gate selector dropdown.
   - Live scan log feed with search & status badges.
   - Worker name assignment dialog.
3. **Page**: Mount `EventCheckinScannerCard` in `client/src/pages/EventDetailPage.tsx` and `client/src/pages/VolunteerConsolePage.tsx`.
