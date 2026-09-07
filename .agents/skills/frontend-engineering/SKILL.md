---
name: frontend-engineering
description: Standards, architecture, state management, and component boundaries for React 18 / Vite / TypeScript. Use when modifying or building frontend features.
---

# Frontend Engineering Skill — Ticketification

## Purpose
Establishes engineering standards for the React 18 / TypeScript / Vite frontend application, ensuring modularity, predictability, type safety, and zero leakage of backend business rules.

## When to Use
- Adding or modifying React pages, components, hooks, context providers, or API clients.
- Implementing UI flows: Event management, Guest Import Wizard, Ticket Console, Mobile Scanner, and Downloads.

## Architectural Guidelines
1. **Separation of Concerns**:
   - `pages/`: Route-level container components orchestrating data fetching and page layout.
   - `components/`: Pure, reusable, or feature-specific UI components without direct route dependencies.
   - `api/`: Centralized HTTP client modules encapsulating Axios/Fetch calls. No inline `fetch()` or `axios.get()` calls scattered in components.
   - `context/`: Cross-cutting application state (Auth, Active Event, Toast Notifications).
   - `types/`: Domain-specific TypeScript interfaces.

2. **Server-Authoritative Business Logic**:
   - Never determine ticket validity or check-in state on the client.
   - Never determine usage policy (e.g. Single-Use vs Reusable) purely on the frontend.
   - The scanner sends the scanned token to `POST /api/verify/scan-and-checkin` or `POST /api/events/:eventId/verify` and displays the server's authoritative response.

3. **Asset Handling & Ticket Download**:
   - The frontend MUST NOT convert SVGs to PNG in the browser via canvas/blob tricks.
   - The backend stores real PNG assets in Supabase Storage.
   - Individual download triggers downloading the server-provided or Supabase-hosted PNG asset directly.
   - Bulk download triggers streaming `GET /api/tickets/events/:eventId/export-zip` directly to a file download.

4. **Error Handling & User Feedback**:
   - Centralize API errors using clean toast notifications or contextual inline banners.
   - Never expose raw SQL errors, stack traces, or technical jargon to the user.
   - Handle loading, empty, and error states gracefully on every asynchronous view.

## Common Mistakes to Avoid
- Creating giant 800+ line monolithic components. Split sub-views (e.g. import wizard steps, ticket tables) into focused sub-components.
- Relying on local client storage as the source of truth for event/ticket data.
- Directly importing Supabase Service Role key or using client-side Supabase client for privileged DB writes.

## Verification Checklist
- [ ] Code passes TypeScript compilation (`npm run build` in `client/` exits with code 0).
- [ ] No `any` types where strict domain types can be defined.
- [ ] Mobile camera scanner unmounts/stops media tracks properly when navigating away.
