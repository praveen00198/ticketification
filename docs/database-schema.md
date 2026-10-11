# Database Schema & Data Models — Ticketification

## 1. Architectural Source of Truth
This document defines both the **Current Implementation (PostgreSQL + Drizzle ORM)** and the **Target Document Schemas (MongoDB)** as part of the planned architectural evolution toward an Event Operating + Credential Platform.

> [!CRITICAL]
> **Data Storage Boundary**:
> The database stores structured metadata, indexes, and relationship records. The database **MUST NEVER** store binary files, base64 image strings, PDF blobs, or ZIP archives. All binaries belong in **Supabase Storage**.

---

## 2. Target Architecture Schemas (MongoDB)

### 2.1 Collection: `users` (Global Application Profiles)
```typescript
interface UserDocument {
  _id: ObjectId;
  supabaseUserId: string;       // Foreign identity UUID from Supabase Auth (Unique Index)
  email: string;                // Canonical email address (Unique Index)
  name: string;
  phone?: string;
  avatarUrl?: string;
  platformRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; // Global platform authorization
  status: 'ACTIVE' | 'SUSPENDED';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Collection: `events` (Event Master Entity)
```typescript
interface EventDocument {
  _id: ObjectId;
  ownerId: ObjectId;            // References users._id (Host creator, Indexed)
  eventType: 
    | 'CONCERT' 
    | 'HACKATHON' 
    | 'WORKSHOP' 
    | 'CONFERENCE' 
    | 'SEMINAR' 
    | 'SPORTS' 
    | 'COMPETITION' 
    | 'COLLEGE_FEST' 
    | 'EXPO' 
    | 'CORPORATE_EVENT' 
    | 'AWARD_CEREMONY' 
    | 'PRIVATE_EVENT' 
    | 'WEDDING' 
    | 'OTHER';
  credentialTerminology: string; // e.g. "Ticket", "Participant Pass", "Badge"
  name: string;
  description?: string;
  venue?: string;
  isVirtual: boolean;
  virtualMeetingUrl?: string;
  startAt: Date;
  endAt: Date;
  registrationMode: 'TICKETIFICATION_REGISTRATION' | 'EXISTING_ATTENDEE_DATA' | 'EXTERNAL_API';
  isPaid: boolean;
  capacity?: number;
  registrationCapacity?: number;
  status: 
    | 'DRAFT' 
    | 'SUBMITTED' 
    | 'UNDER_REVIEW' 
    | 'APPROVED' 
    | 'PUBLISHED' 
    | 'REGISTRATION_OPEN' 
    | 'REGISTRATION_CLOSED' 
    | 'EVENT_LIVE' 
    | 'COMPLETED' 
    | 'ARCHIVED' 
    | 'REJECTED' 
    | 'SUSPENDED' 
    | 'CANCELLED';
  verificationLevel: 'UNVERIFIED' | 'LOW' | 'MEDIUM' | 'HIGH';
  institutionId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 Collection: `event_members` (Event-Scoped RBAC)
```typescript
interface EventMemberDocument {
  _id: ObjectId;
  eventId: ObjectId;            // References events._id (Compound Index)
  userId: ObjectId;             // References users._id (Compound Index)
  role: 'HOST' | 'COORDINATOR' | 'VOLUNTEER' | 'MENTOR' | 'EVALUATOR';
  permissions: EventPermission[];
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  invitationToken?: string;     // Cryptographic single-use token (72h TTL)
  invitationExpiresAt?: Date;
  invitedBy: ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type EventPermission =
  | 'MANAGE_EVENT_SETTINGS'
  | 'MANAGE_STAFF'
  | 'MANAGE_ATTENDEES'
  | 'IMPORT_ATTENDEES'
  | 'CONFIGURE_CREDENTIALS'
  | 'GENERATE_CREDENTIALS'
  | 'DOWNLOAD_CREDENTIALS'
  | 'SCAN_CREDENTIALS'
  | 'VIEW_ASSIGNED_TASKS'
  | 'UPDATE_ASSIGNED_TASKS'
  | 'MENTOR_ASSIGNED_TEAMS'
  | 'SCORE_ASSIGNED_TEAMS'
  | 'VIEW_EVALUATION_RESULTS'
  | 'EXPORT_EVENT_DATA';
```

### 2.4 Collection: `credentials` (Event Credentials & Pass Metadata)
```typescript
interface CredentialDocument {
  _id: ObjectId;
  eventId: ObjectId;            // References events._id (Indexed)
  attendeeId?: ObjectId;        // References attendees._id or users._id (Indexed)
  credentialType: string;       // e.g. "GENERAL", "VIP", "WORKER", "MENTOR"
  displayName: string;
  status: 'ACTIVE' | 'CHECKED_IN' | 'CANCELLED';
  usagePolicy: 'SINGLE_USE' | 'REUSABLE';
  verificationToken: string;    // 64-char crypto hash (Unique Index)
  templateId: ObjectId;         // References credential_templates._id
  storageKey: string;           // events/{eventId}/credentials/{id}.png
  assetUrl?: string;            // Signed CDN URL
  sequenceNumber: number;       // Compound Unique Index on { eventId, sequenceNumber }
  generatedAt: Date;
  checkedInAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.5 Collection: `teams` (Hackathons & Competitions)
```typescript
interface TeamDocument {
  _id: ObjectId;
  eventId: ObjectId;            // References events._id (Compound Index)
  teamName: string;
  projectTitle?: string;
  projectDescription?: string;
  repositoryUrl?: string;
  assignedEvaluators: ObjectId[]; // Array of users._id
  assignedMentors: ObjectId[];    // Array of users._id
  members: {
    userId?: ObjectId;
    name: string;
    email: string;
    role: 'LEADER' | 'MEMBER';
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.6 Collection: `evaluations` (Blind Scoring Rubrics)
```typescript
interface EvaluationDocument {
  _id: ObjectId;
  eventId: ObjectId;
  teamId: ObjectId;             // References teams._id (Compound Index)
  evaluatorId: ObjectId;        // References users._id (Compound Index)
  criteriaScores: {
    criterionId: string;
    criterionName: string;
    score: number;
    maxScore: number;
  }[];
  totalScore: number;
  notes?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'FINALIZED';
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.7 Collection: `jobs` (Asynchronous Bulk Operations)
```typescript
interface JobDocument {
  _id: ObjectId;
  eventId: ObjectId;
  type: 'BULK_CREDENTIAL_GEN' | 'EXCEL_IMPORT' | 'ZIP_EXPORT';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progressPercent: number;      // 0 to 100
  totalItems: number;
  processedItems: number;
  failedItems: number;
  resultPayload?: {
    storageKey?: string;
    downloadUrl?: string;
    report?: Record<string, any>;
  };
  errorMessage?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.8 Collection: `audit_logs` (Immutable Administrative History)
```typescript
interface AuditLogDocument {
  _id: ObjectId;
  actorId: ObjectId;            // References users._id
  eventId?: ObjectId;           // Scoped event ID
  action: string;               // e.g. "STAFF_INVITED", "SCORE_OVERRIDDEN", "EVENT_SUSPENDED"
  targetEntity: string;         // e.g. "event_members", "evaluations"
  targetId: ObjectId;
  metadata: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;              // Immutable timestamp
}
```

---

## 3. Legacy / Current Implementation (PostgreSQL + Drizzle ORM)
The existing codebase currently runs with the following PostgreSQL tables in Supabase:
- `users`: (id, name, email, role, created_at, updated_at)
- `events`: (id, name, date, time, venue, description, organizer_name, status, created_by, created_at, updated_at)
- `ticket_types`: (id, event_id, name, label, usage_policy, created_at)
- `guests`: (id, event_id, name, email, phone, organization, designation, category, import_id)
- `tickets`: (id, event_id, guest_id, ticket_type_id, verification_token, status, usage_policy, asset_path, asset_url, sequence_number, created_by)
- `ticket_checkins`: (id, ticket_id, event_id, checked_in_at, verified_by, worker_name_assigned)
- `guest_imports`: (id, event_id, file_name, total_rows, valid_rows, invalid_rows, skipped_rows, column_mapping, required_fields, category_mapping, status, error_report, created_by)

---

## 4. Migration & Coexistence Roadmap
- **Phase 0–1**: Fix security flaws in auth and authorization logic while preserving PostgreSQL data.
- **Phase 2**: Provision MongoDB connection, define Mongoose/MongoDB native models, and establish dual-database coexistence without breaking existing records.
- **Phase 3–18**: Progressively implement Host features, event memberships, evaluations, credentials, and background workers using the target MongoDB schema.
- **Zero Data Loss**: Existing events and tickets in PostgreSQL will be preserved and migrated cleanly.
