# Implementation Phases

## Phase 0 — Discovery + Documentation ✅
- Repository inspection
- Architecture assessment
- Documentation suite creation
- Implementation plan

## Phase 1 — Foundation + Supabase + Auth
- Remove MongoDB, delivery module, email/PDF services
- Install Drizzle ORM + PostgreSQL driver
- Supabase client configuration
- Drizzle schema definitions (all tables)
- Environment configuration rewrite
- Supabase Auth integration (register/login/me)
- Auth middleware for Supabase JWT
- Health endpoint
- **Acceptance**: Register → Login → Protected routes work

## Phase 2 — Event Management
- Event CRUD (create, read, update, delete/archive)
- Event ownership enforcement
- Default ticket types creation on event creation
- Frontend: Event list, create form, detail view
- **Acceptance**: User A cannot access User B's events

## Phase 3 — Smart Guest Import & Data Mapping
- Excel/CSV upload + analysis
- Dynamic header detection + confidence scoring
- Column mapping UI (manual + auto-detected)
- Required vs optional field configuration (per-import)
- Category mapping (Excel values → system categories)
- Row-level validation with error reporting
- Duplicate detection
- Partial import support
- Import audit records (`guest_imports` table)
- Import configuration persistence
- Large-file handling
- Multi-step API: analyze → validate → confirm
- Frontend: 5-step import wizard
- **Acceptance**: Missing optional fields don't block import. 1,400+ rows handled.

## Phase 4 — Ticket Engine
- Ticket creation with verification tokens
- Usage policy tied to ticket type
- Event + guest association
- Worker unassigned support (NULL guest_id)
- Sequence numbers for deterministic ordering
- **Acceptance**: Every ticket has unique verification token. No duplicates.

## Phase 5 — Ticket Rendering
- Puppeteer rendering pipeline (adapted)
- Template integration
- QR + guest name overlay
- "UNASSIGNED" state for worker tickets
- High-res PNG output (1620×2025)
- **Acceptance**: 100 tickets render consistently. QR scans work.

## Phase 6 — Storage + Download
- Supabase Storage with event-scoped paths
- Individual download
- Bulk ZIP generation
- Asset metadata in tickets table
- **Acceptance**: Tickets downloadable individually and in bulk

## Phase 7 — Verification Engine
- Token lookup + event scoping
- Status + usage policy evaluation
- Safe verification responses (no internal data leaked)
- All response types implemented
- **Acceptance**: All 7 response types correct

## Phase 8 — Scanner + Event-Day Check-in
- Mobile-first QR scanner
- Event selection
- Atomic single-use check-in
- Reusable worker check-in
- Clear scanner states
- **Acceptance**: Race condition test passes. Worker multi-scan works.

## Phase 9 — Worker System
- Generate N unassigned worker tickets
- Assign name on first scan
- Persist assignment
- Multiple check-in records
- **Acceptance**: Assigned name persists on subsequent scans

## Phase 10 — Dashboard + Reporting
- Event-scoped statistics
- Category breakdown
- Check-in counts
- Recent check-ins (with explicit ORDER BY)
- **Acceptance**: All queries deterministically ordered

## Phase 11 — Security + Testing + Quality
- RLS policies
- Rate limiting
- Input validation
- Security headers
- Unit + integration tests
- TypeScript strict check
- Production build
- **Acceptance**: Build passes, tests pass

## Phase 12 — Production Deployment
- Deployment documentation
- Environment configuration
- CORS, HTTPS
- Database migrations
- Seed data
