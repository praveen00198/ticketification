---
name: security-engineering
description: Security principles, IDOR prevention, input sanitization, token security, and authorization controls.
---

# Security Engineering Skill — Ticketification

## Purpose
Establishes defensive security controls across all layers of Ticketification to eliminate vulnerabilities such as IDOR, token tampering, path traversal, and sensitive data leakage.

## When to Use
- Writing or reviewing API routes, authentication/authorization middleware, file upload/download endpoints, and verification workflows.

## Mandatory Security Principles

### 1. Zero Trust Event Scoping (IDOR Prevention)
- Client-supplied `eventId` or `ticketId` must NEVER be trusted blindly.
- Every event query or mutation MUST verify that the authenticated user owns or is authorized to access the event:
  ```ts
  const event = await eventRepository.findByIdAndOwner(eventId, userId);
  if (!event) throw new AppError('Event not found or unauthorized', 404);
  ```
- Verification must confirm that the ticket belongs strictly to the active event being scanned:
  ```ts
  if (ticket.eventId !== scannerEventId) return { status: 'WRONG_EVENT', ... };
  ```

### 2. Opaque Verification Tokens (No PII in QR)
- QR codes MUST contain only an opaque, cryptographically random token or a URL pointing to the token:
  `https://APP_DOMAIN/verify/<SECURE_64_CHAR_TOKEN>`
- NEVER encode guest phone numbers, emails, full names, or internal database primary keys into the QR code payload.
- All verification and usage checks happen exclusively server-side.

### 3. File Upload & Download Security
- **Excel Upload**:
  - Validate file extension (`.xlsx`, `.xls`, `.csv`).
  - Validate MIME type and buffer signature.
  - Limit file size (max 10MB).
  - Use memory streams or temporary files in isolated scratch directories; clean up temporary files immediately.
- **Filename Sanitization**:
  - Sanitize all generated download filenames: strip `/`, `\`, `..`, null bytes, control characters, and illegal filesystem characters.
  - Never allow path traversal.

### 4. Concurrency & Race Condition Prevention
- Check-ins for single-use tickets must be executed atomically using conditional database updates:
  ```sql
  UPDATE tickets
  SET status = 'USED', updated_at = now()
  WHERE id = $1 AND status = 'ACTIVE';
  ```
- If affected rows === 0, the ticket was already checked in (or invalid); immediately return `ALREADY_USED`. Two simultaneous scans can never both succeed.

### 5. Secrets & Information Disclosure
- Strip internal error messages, SQL errors, and stack traces before sending responses to clients.
- Never log service role keys, passwords, or raw auth headers.
- Enforce CORS with specific authorized origins; avoid wildcard CORS in production environments.

## Verification Checklist
- [ ] Every protected route has `authMiddleware`.
- [ ] Ownership checks exist on all event-scoped mutations.
- [ ] Filenames sanitized against path traversal.
- [ ] No secrets logged or returned in HTTP error payloads.
