# Verification & Check-in Rules — Ticketification

## 1. Scanner Authorization & Security
- **Explicit Scanner Permission**: Only authenticated users with an active membership in `event_members` granting `SCAN_CREDENTIALS` can execute check-in operations.
- **Event Scoping**: The scanner operates strictly within its active event context. Any scanned token belonging to a different event immediately returns `WRONG_EVENT`.
- **Zero Information Leaks**: Verification responses never expose database IDs, internal tokens, or raw PII. Only minimal presentation fields (Attendee Name, Credential Type, Status) are returned.

---

## 2. High-Throughput Verification Flow
```
Scanner sends: { token, eventId }
  │
  ├─► 1. Verify Scanner Authorization (event_members: SCAN_CREDENTIALS)
  ├─► 2. Lookup Credential by verification_token
  ├─► 3. If not found ➔ INVALID
  ├─► 4. If credential.eventId !== eventId ➔ WRONG_EVENT
  ├─► 5. If credential.status === 'CANCELLED' ➔ CANCELLED
  ├─► 6. If credential.status === 'CHECKED_IN' (Single-use) ➔ ALREADY_CHECKED_IN
  ├─► 7. If credential.status === 'ACTIVE':
          ├─► If usagePolicy === 'REUSABLE':
          │     ├─► If attendeeId is NULL ➔ UNASSIGNED_WORKER (Prompt name)
          │     └─► Else ➔ VALID_WORKER (Check in & append log)
          └─► If usagePolicy === 'SINGLE_USE' ➔ VALID (Execute atomic check-in)
```

---

## 3. Concurrency Control & Atomic Single-Use Check-In
To guarantee that two scanners scanning the same credential simultaneously can never both check in the pass:

### Target MongoDB Atomic Update
```typescript
const updated = await db.collection('credentials').findOneAndUpdate(
  { verificationToken: token, status: 'ACTIVE' },
  { $set: { status: 'CHECKED_IN', checkedInAt: new Date() } },
  { returnDocument: 'after' }
);

if (!updated) {
  // Pass was already used by another scanner or cancelled
  const existing = await db.collection('credentials').findOne({ verificationToken: token });
  return { status: 'ALREADY_CHECKED_IN', checkedInAt: existing.checkedInAt };
}

// Exactly one winner succeeds
await db.collection('credential_checkins').insertOne({
  credentialId: updated._id,
  eventId: updated.eventId,
  scannedBy: req.user.id,
  scannedAt: new Date()
});
return { status: 'SUCCESS', credential: updated };
```

### Legacy PostgreSQL Equivalent
```sql
UPDATE tickets
SET status = 'USED', updated_at = NOW()
WHERE id = $1 AND status = 'ACTIVE'
RETURNING *;
```

---

## 4. Reusable Staff / Worker Pass Workflow
1. Reusable credentials maintain `status = 'ACTIVE'` across check-ins.
2. Every scan appends an entry to the check-in history collection (`credential_checkins`).
3. **Unassigned Worker Pass**: On the first scan, if no attendee name is assigned, the scanner UI prompts the operator for a staff name. The name is saved and the first check-in is recorded in a single atomic transaction. Subsequent scans display the assigned name.
