# PROJECT_CONTEXT.md — Project Memory & Status

## Project Overview
QR Ticket Generation & WhatsApp Delivery System MVP for operational event management. Allows admin login/registration, guest list preparation/Excel import with phone validation, batch ticket image & QR generation via Puppeteer, automated WhatsApp delivery via Meta WhatsApp Business Cloud API (with email fallback), and browser camera QR scanning for event-day check-in.

## Environment Variables & Configuration
- `NODE_ENV`: Application environment (`development` | `production`).
- `PORT`: Server port (Default: `3000`).
- `MONGODB_URI`: MongoDB connection string (**Secret**).
- `JWT_SECRET`: Secret key for signing admin JWT tokens (**Secret**).
- `JWT_EXPIRES_IN`: JWT expiration string (Default: `1d`).
- `DELIVERY_PROVIDER`: Active ticket delivery provider (`whatsapp` | `email`).
- `WHATSAPP_ENABLED`: Enable WhatsApp delivery (`true` | `false`).
- `WHATSAPP_MOCK`: Enable mock delivery mode for dev (`true` | `false`).
- `WHATSAPP_PHONE_NUMBER_ID`: Meta Cloud API Phone Number ID.
- `WHATSAPP_ACCESS_TOKEN`: Meta System User Access Token (**Secret**).
- `WHATSAPP_API_VERSION`: Meta Graph API version (Default: `v20.0`).
- `WHATSAPP_TICKET_TEMPLATE_NAME`: Approved Meta Template Name (Default: `event_ticket`).
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Verification token for Meta webhooks.
- `APP_URL`: Frontend application domain URL (`http://localhost:5173`).
- `VITE_API_URL`: Backend REST API endpoint for frontend client.

## Current Implementation Status
- **Environment & Git Setup**: Completed.
- **Core Architecture & Docs**: Completed with WhatsApp Integration guide (`docs/whatsapp-integration.md`).
- **Ticket Image Rendering**: Puppeteer PNG 800x1200 ticket generation completed.
- **WhatsApp Cloud API Integration**: Completed with Mock Mode & Webhook tracking.
- **Frontend Console**: Complete with WhatsApp statistics, phone normalization previews, and camera QR scanner.
