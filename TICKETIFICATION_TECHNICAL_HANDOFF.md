# Ticketification — Technical Architecture Handoff & Discovery Overview

## 1. Executive Summary

Ticketification is an **Event Operating, Credential, and Access Platform** built to serve both general attendees and event organizers. It enables discovery and registration, spreadsheet-based guest ingestion, automated visual pass generation with cryptographic QR codes, atomic gate turnstile check-ins, attendee pass wallets, and team evaluation workspaces.

This document serves as the master engineering handoff. Complete discovery audits are available in the [Application Audit Directory](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/):

1. [00_EXECUTIVE_SUMMARY.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/00_EXECUTIVE_SUMMARY.md): Current verified state, major blockers, and executive priorities.
2. [01_PRODUCT_AND_CAPABILITIES.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/01_PRODUCT_AND_CAPABILITIES.md): Product concept, user archetypes, and complete capability matrix.
3. [02_SYSTEM_ARCHITECTURE.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/02_SYSTEM_ARCHITECTURE.md): Frontend, backend, database architecture, and Mermaid sequence diagrams.
4. [03_ROUTES_AND_NAVIGATION.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/03_ROUTES_AND_NAVIGATION.md): Complete route inventory, layout nesting, and route guards.
5. [04_AUTH_AND_RBAC.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/04_AUTH_AND_RBAC.md): Standalone custom authentication, token mechanics, and security invariants.
6. [05_DATABASE_AND_DATA_FLOWS.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/05_DATABASE_AND_DATA_FLOWS.md): MongoDB entity inventory (18 models), relationships, and data isolation.
7. [06_FEATURE_WORKFLOWS.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/06_FEATURE_WORKFLOWS.md): Traced step-by-step user journeys from UI to database.
8. [07_TICKETING_AND_ENTRY_OPERATIONS.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/07_TICKETING_AND_ENTRY_OPERATIONS.md): Excel parsing, Sharp pass rendering, and atomic check-ins.
9. [08_TESTING_AND_QUALITY.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/08_TESTING_AND_QUALITY.md): Test suite analysis, executed verification commands, and results.
10. [09_GAP_ANALYSIS_AND_ROADMAP.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/09_GAP_ANALYSIS_AND_ROADMAP.md): Product requirements vs code gap matrix and 4-phase roadmap.
11. [10_FILE_AND_MODULE_INDEX.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/10_FILE_AND_MODULE_INDEX.md): File catalogue, entry points, and legacy module status.
12. [11_DECISIONS_AND_UNKNOWNS.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/docs/application-audit/11_DECISIONS_AND_UNKNOWNS.md): Grounded ADRs and unresolved product decisions.

---

## 2. Verified Technology Stack

| Layer | Technologies | Role / Responsibility |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Axios, html5-qrcode | Single-page application, responsive layouts, client-side camera scanning. |
| **Backend** | Node.js, Express, TypeScript, Sharp, xlsx, archiver, qrcode, Resend SDK | Modular REST API monolith, image rendering, spreadsheet parsing, archive streaming. |
| **Primary Database** | MongoDB (Mongoose 9.11) | Authoritative store for users, events, credentials, check-ins, tasks, and audit logs. |
| **Object Storage** | Supabase Storage (`ticket-images`) | S3-compatible cloud storage for rendered PNG passes and generated assets. |
| **Legacy Database** | PostgreSQL (Drizzle ORM) | Retained for backward-compatible fallback routes (scheduled for deprecation). |

---

## 3. High-Priority Engineering Actions

1. **Retire PostgreSQL/Drizzle Schema**: Standardize 100% of routes on MongoDB to eliminate dual-stack maintenance overhead.
2. **Enforce Asynchronous Job Worker for Bulk Rendering**: Route all batch ticket rendering through `eventJobQueueService` to safeguard Node.js memory.
3. **Verify Resend Domain for Pass Delivery**: Add custom sender domain DNS records to enable automatic email delivery of passes upon registration.
4. **Develop Offline PWA Turnstile Mode**: Provide local token signature verification for convention centers with poor mobile connectivity.
