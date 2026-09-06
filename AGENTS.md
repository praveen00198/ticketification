# AGENTS.md — Permanent Project Rules & Guidelines

## Project Purpose
QR Ticket Generation & WhatsApp Delivery System — an operational event ticketing console for administrators to import guest lists, validate contact records (E.164 phone normalization), generate cryptographically verified image/QR tickets, deliver tickets via WhatsApp Business Cloud API (or optional email), and scan QR tickets on event day.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Meta WhatsApp Business Cloud API, Resend, Puppeteer, `qrcode`, `jsonwebtoken`, `bcryptjs`.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, `html5-qrcode`, Lucide React.

## Environment & Secrets Rules
1. Never commit actual secret keys (`JWT_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `RESEND_API_KEY`, MongoDB production credentials) to Git.
2. Track `.env.example` templates in root, `server/`, and `client/`.
3. Backend configuration must be accessed strictly through `config.env` from `server/src/config/env.ts`.
4. Frontend environment variables must use `VITE_` prefix and never expose private server credentials.

## Architecture Constraints
- Modular monolith pattern: routes -> controllers -> services -> repositories -> models.
- Delivery Provider abstraction: `DeliveryService` routes to `WhatsAppProvider` (default) or `EmailProvider` based on `DELIVERY_PROVIDER`.
- QR code verification and check-in status checks must be evaluated exclusively server-side.
- QR payload contains secure token URL (`https://APP_DOMAIN/verify/<SECURE_TOKEN>`), never raw personal details.

## Relevant Context Files
- [PROJECT_CONTEXT.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/PROJECT_CONTEXT.md)
- [docs/whatsapp-integration.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/whatsapp-integration.md)
- [docs/architecture.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/architecture.md)
- [docs/data-flow.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/data-flow.md)
- [docs/api-contracts.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/api-contracts.md)
- [docs/database-schema.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/database-schema.md)
- [docs/design-system.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/design-system.md)
