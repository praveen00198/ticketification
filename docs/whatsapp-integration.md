# WhatsApp Business Cloud API Integration Guide

This document describes the Meta WhatsApp Business Cloud API integration for the QR Ticket Generation & Delivery System.

---

## 1. Architecture Overview

The system uses the **Official Meta WhatsApp Business Cloud API** (Graph API `v20.0`) to deliver high-resolution scannable image tickets directly to attendees' WhatsApp numbers.

```
+-------------------+        +--------------------+        +---------------------+
|   TicketService   | -----> |  DeliveryService   | -----> |  WhatsAppProvider   |
+-------------------+        +--------------------+        +---------------------+
                                                                      |
                                                                      v
                                                           +---------------------+
                                                           | Meta Graph API v20  |
                                                           |  1. Upload Media    |
                                                           |  2. Send Template   |
                                                           +---------------------+
                                                                      |
                                                                      v
                                                           +---------------------+
                                                           | Guest WhatsApp App  |
                                                           +---------------------+
```

---

## 2. Configuration & Environment Variables

Configure the following variables in `server/.env`:

```env
# Delivery Provider Switch ('whatsapp' | 'email')
DELIVERY_PROVIDER=whatsapp

# Meta WhatsApp Business Cloud API Credentials
WHATSAPP_ENABLED=true
WHATSAPP_MOCK=false
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_ACCESS_TOKEN=EAAB...your_system_user_token
WHATSAPP_API_VERSION=v20.0
WHATSAPP_TICKET_TEMPLATE_NAME=event_ticket
WHATSAPP_TICKET_TEMPLATE_LANGUAGE=en
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_custom_webhook_secret_token

# Bulk Batching & Rate Limiting Controls
WHATSAPP_BATCH_SIZE=20
WHATSAPP_CONCURRENCY=5
WHATSAPP_DELAY_MS=200

# Ticket Storage URL Base
TICKET_STORAGE_PROVIDER=local
TICKET_STORAGE_BASE_URL=https://your-domain.com
```

---

## 3. Meta WhatsApp Template Specification

Before sending tickets in production, create and approve the following template in the **Meta WhatsApp Business Manager**:

- **Template Name**: `event_ticket`
- **Category**: `MARKETING` or `UTILITY`
- **Language**: `en` (English)
- **Header**: `MEDIA` -> `IMAGE` (Example sample ticket image uploaded for review)
- **Body**:
  ```text
  Hello {{1}},

  Your official ticket for *{{2}}* on *{{3}}* is ready!

  Ticket ID: *{{4}}*

  Please present the QR code attached in the image above at the event entrance for verification.
  ```
- **Variables Mapping**:
  - `{{1}}` -> Guest Full Name
  - `{{2}}` -> Event Name
  - `{{3}}` -> Event Date
  - `{{4}}` -> Unique Ticket ID (e.g. `EVT26-000001`)

---

## 4. Phone Number Normalization & Validation (E.164)

The system automatically parses and normalizes guest phone numbers from Excel uploads into the standard **E.164 international format**:

| Raw Excel Input | Normalized Output | Status |
| :--- | :--- | :--- |
| `9876543210` (10-digit Indian) | `+919876543210` | Valid |
| `09876543210` (Leading zero) | `+919876543210` | Valid |
| `+919876543210` | `+919876543210` | Valid |
| `+1-555-123-4567` (US format) | `+15551234567` | Valid |
| `12345` (Too short) | `null` | Rejected with diagnostic error |

---

## 5. Webhook Setup & Real-time Delivery Status Tracking

Meta sends delivery callbacks to update ticket delivery statuses (`SENT`, `DELIVERED`, `READ`, `FAILED`).

### Endpoints
- `GET /api/webhook`: Webhook verification challenge (`hub.challenge` validated against `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
- `POST /api/webhook`: Status callbacks from Meta.

### Meta Webhook Subscription Fields
1. Navigate to **Meta Developer Portal -> WhatsApp -> Configuration -> Webhook**.
2. Set Callback URL: `https://your-domain.com/api/webhook`.
3. Set Verify Token: matching `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. Subscribe to the `messages` field.

---

## 6. Development & Local Testing Mock Mode

When `WHATSAPP_MOCK=true` or `WHATSAPP_ENABLED=false`:
- Puppeteer generates deterministic ticket images (`server/uploads/tickets/ticket-XYZ.png`).
- Image is previewable via `GET http://localhost:3000/uploads/tickets/ticket-XYZ.png`.
- Delivery is logged to the console without consuming Meta API quota or requiring a live business account.
- Status is immediately updated to `SENT`.

---

## 7. Production Checklist

- [ ] Meta Business Account verified.
- [ ] WhatsApp Business phone number registered and connected to Cloud API.
- [ ] System User Permanent Access Token generated with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.
- [ ] Message template `event_ticket` approved by Meta.
- [ ] Webhook URL registered and verified with SSL (`https://`).
- [ ] Reverse proxy (e.g. Nginx) configured to serve `/uploads/tickets/` with proper cache headers.
- [ ] Rate limits monitored (Standard Cloud API allows 80 messages/second).
