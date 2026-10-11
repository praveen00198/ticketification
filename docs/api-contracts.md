# REST API Contracts — Ticketification Platform

## 1. Base URL & Security Protocol
- **Base URL**: `/api`
- **Security**: All endpoints except `/api/auth/login`, `/api/auth/register`, and `/api/health` require a valid Supabase JWT Bearer token: `Authorization: Bearer <token>`.
- **Zero-Trust Boundary**: Being authenticated does not automatically authorize access. Every route checks platform roles or event-scoped memberships via `event_members`.

---

## 2. Authentication Module (`/api/auth`)

### POST `/api/auth/register`
Registers a new global user. Always assigns platform role `USER`.
```json
// Request
{
  "name": "Aman Patel",
  "email": "aman@example.com",
  "password": "SecurePassword123"
}

// Response 201
{
  "success": true,
  "data": {
    "user": {
      "id": "6704b...a1",
      "supabaseUserId": "uuid...",
      "name": "Aman Patel",
      "email": "aman@example.com",
      "platformRole": "USER"
    },
    "token": "supabase_jwt..."
  }
}
```

### POST `/api/auth/login`
Authenticates credentials via Supabase Auth and returns JWT.

### GET `/api/auth/me`
Returns current authenticated user profile, platform role, and active event memberships.

---

## 3. Events Module (`/api/events`)

### GET `/api/events`
Lists events owned by or accessible to the user (via `event_members`).

### POST `/api/events`
Creates a new event draft. User becomes `HOST` and owner.
```json
// Request
{
  "name": "National Hackathon 2026",
  "eventType": "HACKATHON",
  "credentialTerminology": "Participant Pass",
  "registrationMode": "TICKETIFICATION_REGISTRATION",
  "isPaid": false,
  "startAt": "2026-11-01T09:00:00Z",
  "endAt": "2026-11-03T18:00:00Z",
  "venue": "Campus Convention Center"
}
```

### GET `/api/events/:eventId`
Retrieves event metadata. Verifies user is member or event is public.

### PATCH `/api/events/:eventId`
Updates event configuration. Requires `HOST` role.

### POST `/api/events/:eventId/submit-verification`
Submits event for Platform Admin risk review.

---

## 4. Staff & Membership Module (`/api/events/:eventId/members`)

### POST `/api/events/:eventId/members/invite`
Invites staff member with role (`COORDINATOR`, `VOLUNTEER`, `MENTOR`, `EVALUATOR`) and custom permissions. Generates single-use token.
```json
// Request
{
  "email": "volunteer@example.com",
  "role": "VOLUNTEER",
  "permissions": ["VIEW_ASSIGNED_TASKS", "SCAN_CREDENTIALS"]
}
```

### POST `/api/events/:eventId/members/accept-invite`
Accepts invitation via single-use token and links global user identity.

### GET `/api/events/:eventId/members`
Lists all event staff and permissions.

---

## 5. Teams & Evaluation Module (`/api/events/:eventId`)

### GET `/api/events/:eventId/teams`
Lists event teams. Filterable by track or assignment.

### POST `/api/events/:eventId/teams`
Registers a competition team and team members.

### POST `/api/events/:eventId/evaluations/rubrics`
Configures weighted judging criteria. Requires `HOST` role.

### POST `/api/events/:eventId/evaluations/submit`
Submits scores for assigned team. Requires `EVALUATOR` role with team assignment.

### GET `/api/events/:eventId/evaluations/leaderboard`
Fetches real-time leaderboard.

---

## 6. Asynchronous Jobs Engine (`/api/events/:eventId/jobs`)

### POST `/api/events/:eventId/jobs/bulk-generate-credentials`
Enqueues bulk credential generation.
```json
// Response 202 Accepted
{
  "success": true,
  "data": {
    "jobId": "6704c...9f",
    "status": "PENDING",
    "totalItems": 1500,
    "checkStatusUrl": "/api/events/:eventId/jobs/6704c...9f"
  }
}
```

### GET `/api/events/:eventId/jobs/:jobId`
Returns live progress (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).

### POST `/api/events/:eventId/jobs/export-zip`
Enqueues bulk ZIP creation of pre-existing PNG assets in Supabase Storage.

---

## 7. Verification & Day-of-Event Check-In (`/api/verify`)

### POST `/api/verify/scan`
Single-step atomic verification and check-in.
```json
// Request
{
  "token": "64_char_hex_verification_token",
  "eventId": "6704b...01"
}

// Response 200 OK (Single-use Success)
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "credential": {
      "name": "Rahul Sharma",
      "credentialType": "Participant Pass",
      "checkedInAt": "2026-11-01T09:14:02.100Z"
    }
  }
}

// Response 409 Conflict (Already Checked In)
{
  "success": false,
  "error": {
    "code": "ALREADY_CHECKED_IN",
    "message": "Credential was already checked in.",
    "checkedInAt": "2026-11-01T09:02:15.000Z"
  }
}
```
