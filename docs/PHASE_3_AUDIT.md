# PHASE 3 PRE-IMPLEMENTATION AUDIT
## Host Identity, Organizer Onboarding & Workspace Initialization

**Phase:** Phase 3  
**Status:** Audit Completed / Ready for Implementation  
**Date:** October 9, 2026  

---

## 1. Existing Architecture & Relevant Files

### Backend (`server/`)
- **Server Core:** [server/src/server.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/server.ts) (Express, IPv4 priority, Sharp configuration, MongoDB lifecycle integration).
- **Authentication Middleware:** [server/src/middlewares/auth.middleware.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/auth.middleware.ts) (Validates Supabase JWT, loads server DB profile, populates `req.user: { id, email, role: PlatformRole }`).
- **Authorization Guards:** [server/src/middlewares/authorization.middleware.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/authorization.middleware.ts) (`requireRole`, `requireAdmin`, `requireSuperAdmin`).
- **Database Layer:**
  - PostgreSQL + Drizzle ORM: [server/src/db/schema/users.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/db/schema/users.ts) (Legacy operational data).
  - MongoDB Connection: [server/src/db/mongodb.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/db/mongodb.ts) (Mongoose connection pool, standby mode resilience).
  - MongoDB Target User Model: [server/src/db/mongo/models/user.model.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/db/mongo/models/user.model.ts) (`supabaseUserId`, `email`, `name`, `platformRole`, `status`, `metadata`).
  - MongoDB User Repository: [server/src/modules/auth/repositories/mongo-user.repository.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/auth/repositories/mongo-user.repository.ts).
  - Dual-Database Sync Service: [server/src/modules/auth/services/identity-sync.service.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/auth/services/identity-sync.service.ts).
- **Object Storage:** [server/src/modules/tickets/services/supabase-storage.service.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/tickets/services/supabase-storage.service.ts) (Supabase Storage SDK wrapper for ticket images).
- **Error Handling:** [server/src/middlewares/error.middleware.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/error.middleware.ts) (`ValidationError`, `NotFoundError`, `ConflictError`, `AppError`).

### Frontend (`client/`)
- **App Shell & Routing:** [client/src/App.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/App.tsx) (React Router v6, auth state, `/verify/:token` public route, protected app layout).
- **Layout & Navigation:** [client/src/components/layout/Layout.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/components/layout/Layout.tsx) & [client/src/components/layout/Header.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/components/layout/Header.tsx).
- **Styling:** [client/tailwind.config.js](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/tailwind.config.js) and [client/src/index.css](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/index.css) (Light theme with `#FAF9F6` surface background, `#FFFFFF` cards, `#E4E4E7` borders, and `#18181B` deep charcoal text).
- **API Client:** [client/src/api/client.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/api/client.ts) (Axios instance with Bearer token injection).

---

## 2. Current User Schema & Authentication Flow

1. User authenticates via Supabase Auth (`/api/auth/login` or `/api/auth/register`).
2. Supabase issues access token.
3. Backend middleware [auth.middleware.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/middlewares/auth.middleware.ts) validates token via `supabaseAdmin.auth.getUser(token)`.
4. Backend identifies application user in PostgreSQL and MongoDB (non-blocking sync).
5. User's platform role is strictly `USER` (unless in approved `INITIAL_ADMIN_EMAILS`).
6. **Gap for Phase 3:** The user record does not yet persist structured organizer profile metadata (`organizationName`, `institutionType`, `institutionName`, `phone`, `bio`, `logoUrl`, `onboardedAt`) nor workspace/verification statuses (`workspaceStatus: 'ACTIVE'`, `verificationStatus: 'UNVERIFIED'`).

---

## 3. Existing Storage Upload Patterns

- `SupabaseStorageService` manages the `ticket-images` bucket using `supabaseAdmin` or `supabaseStorageAdmin`.
- Tickets are placed under `events/{eventId}/tickets/{filename}`.
- **Requirement for Phase 3:** Organizer assets (logos/avatars) must be stored under `hosts/{userId}/assets/{filename}`.
- Uploads must be strictly validated for MIME type (`image/png`, `image/jpeg`, `image/webp`), size (< 2MB), and user ownership.

---

## 4. Component Classification (KEEP / MODIFY / REPLACE / REMOVE)

| Component | Classification | Rationale |
|---|---|---|
| **Supabase Auth Integration** | `KEEP` | Established identity provider; zero changes needed. |
| **Drizzle / PostgreSQL Tables** | `KEEP` | Preserves existing operational event and ticket records. |
| **Sharp & Ticket Image Pipeline** | `KEEP` | Functioning container-safe ticket rendering pipeline; zero changes. |
| **QR Code & Verification Pipeline** | `KEEP` | High-throughput atomic scanning and verification pipeline; zero changes. |
| **MongoDB UserModel** | `MODIFY` | Extend schema with `hostProfile`, `workspaceStatus`, and `hostVerificationStatus`. |
| **MongoUserRepository** | `MODIFY` | Add methods to find, update, and persist host profile and workspace status. |
| **Backend Route Layer** | `MODIFY` | Mount new `/api/host` routes guarded by `authenticateUser`. |
| **Header & Layout Navigation** | `MODIFY` | Add context-aware Organizer Workspace status and Onboarding entry point. |
| **App Routing** | `MODIFY` | Mount `/onboarding` and `/settings/profile` routes. |
| **Host Module (Backend)** | `CREATE` | Create `host.types.ts`, `host.validation.ts`, `host.service.ts`, `host.controller.ts`, `host.routes.ts`. |
| **Host Onboarding Page (Frontend)** | `CREATE` | Create light-themed, accessible, minimal, refined onboarding & profile page. |
| **Host API Client (Frontend)** | `CREATE` | Create `client/src/api/host.ts` to interface with `/api/host/*`. |

---

## 5. Compatibility Risks & Mitigation

1. **Risk:** Unauthenticated users accessing organizer endpoints.  
   **Mitigation:** Guard all `/api/host/*` routes with `authenticateUser`. Derive target `userId` exclusively from `req.user.id`.
2. **Risk:** Overwriting unrelated user fields or escalating platform privileges.  
   **Mitigation:** `hostProfile` updates use atomic Mongoose `$set` targeting only host fields. `platformRole` is never modified during onboarding.
3. **Risk:** Breaking existing offline or standby test runs if MongoDB is unreachable.  
   **Mitigation:** Maintain existing standby resilience in repositories; unit tests use mocked repository layer; integration tests mock DB operations where appropriate.
4. **Risk:** Stale frontend state when completing onboarding.  
   **Mitigation:** Immediately update local user context and trigger refetch of host profile on onboarding completion.

---

## 6. Planned Implementation Sequence

1. **Data Model:** Update [server/src/db/mongo/models/user.model.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/db/mongo/models/user.model.ts) with `IHostProfile`, `InstitutionType`, `WorkspaceStatus`, `HostVerificationStatus`.
2. **Repository:** Add `updateHostProfile`, `getHostProfile` methods in [server/src/modules/auth/repositories/mongo-user.repository.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/auth/repositories/mongo-user.repository.ts).
3. **Storage Extension:** Add `uploadHostAsset` and `deleteHostAsset` to [server/src/modules/tickets/services/supabase-storage.service.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/tickets/services/supabase-storage.service.ts).
4. **Backend Host Module:**
   - [server/src/modules/host/host.types.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/host/host.types.ts)
   - [server/src/modules/host/host.validation.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/host/host.validation.ts)
   - [server/src/modules/host/host.service.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/host/host.service.ts)
   - [server/src/modules/host/host.controller.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/host/host.controller.ts)
   - [server/src/modules/host/host.routes.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/modules/host/host.routes.ts)
   - Mount `/api/host` in [server/src/app.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/server/src/app.ts).
5. **Frontend Implementation:**
   - API client module: [client/src/api/host.ts](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/api/host.ts).
   - Onboarding view: [client/src/pages/HostOnboardingPage.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/pages/HostOnboardingPage.tsx).
   - Profile settings view: [client/src/pages/HostProfilePage.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/pages/HostProfilePage.tsx).
   - Context-aware header navigation updates in [client/src/components/layout/Header.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/components/layout/Header.tsx).
   - Route registration in [client/src/App.tsx](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/client/src/App.tsx).
6. **Automated Testing:**
   - Backend unit & integration test suite: `server/tests/hostOnboarding.test.ts`.
   - Security regression tests (no role escalation, cross-user isolation, unauthenticated rejection).
7. **Build & Regression Verification:**
   - Execute all test suites (`npm test`).
   - Run server and client production builds (`npm run build`).
8. **Documentation Updates:**
   - Record ADR-017 in [DECISION.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/DECISION.md).
   - Update [PHASES.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/PHASES.md) and [ARCHITECTURE.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/ARCHITECTURE.md).
