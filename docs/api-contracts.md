# REST API Contracts

## Authentication
- `POST /api/auth/login`: Authenticates administrator credentials.
- `POST /api/auth/logout`: Clears session token.
- `GET /api/auth/me`: Returns current authenticated admin profile.

## Guests & Excel
- `POST /api/guests/import`: Accepts `.xlsx` upload, returns parsing summary & validation diagnostics.
- `GET /api/guests`: Retrieves guest list.

## Tickets
- `POST /api/tickets/generate`: Bulk generates tickets, QR codes, PDFs, and enqueues Resend emails for confirmed guest records.
- `GET /api/tickets`: Returns filterable ticket database list.
- `GET /api/tickets/:id`: Retrieves ticket detail & PDF link.
- `POST /api/tickets/:id/resend`: Resends existing ticket PDF to guest email without creating a duplicate ticket.

## Verification & Check-in
- `GET /api/tickets/verify/:token`: Server-side lookup of ticket status by secure token.
- `POST /api/tickets/:id/check-in`: Atomic status mutation (`ACTIVE` -> `USED`).

## Dashboard
- `GET /api/dashboard/stats`: Returns operational metric counts (`totalGuests`, `ticketsGenerated`, `emailsSent`, `emailsFailed`, `ticketsUsed`, `ticketsRemaining`).
