# Data Flow Specifications

## 1. Registration & Authentication Flow
```mermaid
flowchart TD
    A[User] --> B[Register Form]
    B --> C[POST /api/auth/register]
    C --> D[Supabase Auth - Create User]
    D --> E[Create Profile in users table]
    E --> F[Return JWT + User Profile]
    F --> G[Store Token - LocalStorage]
    G --> H[Dashboard]
```

## 2. Event Creation Flow
```mermaid
flowchart TD
    A[Dashboard] --> B[Create Event Form]
    B --> C[POST /api/events]
    C --> D[Validate Input]
    D --> E[Insert into events table]
    E --> F[Create Default Ticket Types - VIP, GUEST, WORKER]
    F --> G[Return Event Details]
```

## 3. Smart Guest Import Flow
```mermaid
flowchart TD
    A[Upload Excel] --> B[POST /upload]
    B --> C[Analyze Spreadsheet]
    C --> D[Detect Headers + Sample Data]
    D --> E[POST /analyze]
    E --> F[Show Column Mapping UI]
    F --> G[User Maps Columns + Sets Required Fields]
    G --> H[POST /validate]
    H --> I[Validation Engine]
    I --> J[Show Validation Report]
    J --> K{User Decision}
    K -->|Import Valid| L[POST /confirm]
    K -->|Fix Excel| M[Re-upload]
    L --> N[Create Guest Records in Transaction]
    N --> O[Create Import Audit Record]
```

## 4. Ticket Generation Flow
```mermaid
flowchart TD
    A[Select Guests / Category] --> B[POST /tickets/generate]
    B --> C[For Each Guest]
    C --> D[Generate Verification Token - crypto.randomBytes]
    D --> E[Generate QR Code - URL with Token]
    E --> F[Build HTML Ticket - Template + Dynamic Data]
    F --> G[Render PNG via Puppeteer - 1620x2025]
    G --> H[Upload to Supabase Storage]
    H --> I[Store asset_path in tickets table]
    I --> J[Next Guest]
    J --> C
    J --> K[Return Generation Summary]
```

## 5. Event-Day QR Scanner Check-in Flow
```mermaid
flowchart TD
    A[Admin Login] --> B[Select Event]
    B --> C[Open Scanner]
    C --> D[Scan QR Code - html5-qrcode]
    D --> E[Extract Verification Token from URL]
    E --> F[POST /api/verification/scan]
    F --> G[Lookup Token in PostgreSQL]
    G --> H{Ticket Found?}
    H -->|No| I[INVALID]
    H -->|Yes| J{Event Match?}
    J -->|No| K[WRONG_EVENT]
    J -->|Yes| L{Status Check}
    L -->|CANCELLED| M[CANCELLED]
    L -->|USED + SINGLE_USE| N[ALREADY_USED]
    L -->|ACTIVE + SINGLE_USE| O[VALID - Show CHECK IN]
    L -->|ACTIVE + REUSABLE + No Guest| P[UNASSIGNED_WORKER]
    L -->|ACTIVE + REUSABLE + Has Guest| Q[VALID_WORKER - Show CHECK IN]
    
    O --> R[POST /check-in - Atomic UPDATE]
    Q --> S[POST /check-in - INSERT checkin record]
    P --> T[Assign Name Form]
    T --> U[POST /assign-worker]
    U --> S
```

## 6. Worker Assignment Flow
```mermaid
flowchart TD
    A[Scan Unassigned Worker QR] --> B[UNASSIGNED_WORKER Response]
    B --> C[Show Assign Name Input]
    C --> D[Admin Enters Name]
    D --> E[POST /assign-worker]
    E --> F[Create/Update Guest Record]
    F --> G[Link Guest to Ticket]
    G --> H[Record Check-in]
    H --> I[Future Scans Show Assigned Name]
```
