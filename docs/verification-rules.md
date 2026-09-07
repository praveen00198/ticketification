# Verification & Check-in Rules

## Verification Flow
```
Scanner sends: { token, eventId }
  → Lookup ticket by verification_token
  → If not found → INVALID
  → If found, check ticket.event_id === eventId → else WRONG_EVENT
  → Check ticket.status:
      CANCELLED → CANCELLED
      USED (single-use) → ALREADY_USED
      ACTIVE:
        → If usage_policy === REUSABLE:
            → If guest_id is NULL → UNASSIGNED_WORKER
            → Else → VALID_WORKER
        → If usage_policy === SINGLE_USE → VALID
```

## Verification Response Types
| Status | Meaning | Action |
|---|---|---|
| `VALID` | Active single-use ticket, ready for check-in | Show guest info + [CHECK IN] button |
| `ALREADY_USED` | Single-use ticket already checked in | Show previous check-in time |
| `INVALID` | Token not found in database | Show error |
| `CANCELLED` | Ticket has been cancelled | Show cancelled status |
| `WRONG_EVENT` | Ticket belongs to a different event | Show event mismatch warning |
| `VALID_WORKER` | Active reusable worker ticket with assigned name | Show worker info + [CHECK IN] button |
| `UNASSIGNED_WORKER` | Active reusable worker ticket, no name assigned | Show [ASSIGN NAME] → then [CHECK IN] |

## Check-in Rules

### Single-Use (VIP, GUEST)
```sql
-- Atomic conditional update — exactly one concurrent request succeeds
UPDATE tickets
SET status = 'USED', updated_at = now()
WHERE id = $1 AND status = 'ACTIVE'
RETURNING *;
-- If 0 rows affected → ticket was already used by another scanner
```
Then insert check-in record:
```sql
INSERT INTO ticket_checkins (ticket_id, event_id, verified_by)
VALUES ($1, $2, $3);
```

### Reusable (WORKER)
```sql
-- Do NOT mutate ticket status
-- Only create a check-in record
INSERT INTO ticket_checkins (ticket_id, event_id, verified_by)
VALUES ($1, $2, $3);
```
Ticket remains `ACTIVE` after every check-in.

### Worker Name Assignment
```sql
-- Create or update guest record
INSERT INTO guests (event_id, name, category)
VALUES ($1, $2, 'WORKER')
RETURNING id;

-- Link to ticket
UPDATE tickets SET guest_id = $1 WHERE id = $2;
```
Once assigned, name persists. Future scans show the assigned name.

## Scanner Security
- Scanner operates within a selected event context
- `ticket.event_id` must match the scanner's active event
- Frontend must not trust client-side ticket data — all validation server-side
- No database IDs, internal architecture, or secrets in verification responses
- Only expose: guest name, category, status, check-in time (for ALREADY_USED)

## Race Condition Prevention
Two scanners scanning the same VIP ticket simultaneously:
```
Scanner A → UPDATE ... WHERE status='ACTIVE' → 1 row affected → SUCCESS
Scanner B → UPDATE ... WHERE status='ACTIVE' → 0 rows affected → ALREADY_USED
```
This is guaranteed by PostgreSQL row-level locking during UPDATE.
