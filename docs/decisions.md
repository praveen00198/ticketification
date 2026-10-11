# Architectural Decisions Log — Ticketification

This file mirrors the canonical Architectural Decision Records defined in the project root.
For the complete, binding source of truth, see [DECISION.md](file:///c:/Users/Aman/OneDrive/Desktop/Ticket/DECISION.md).

## Summary of Active Decisions
- **ADR-001**: Modular Monolith over Microservices
- **ADR-002**: One Global User Identity (Roles are event-scoped relationships in `event_members`)
- **ADR-003**: Supabase Auth for Authentication (JWT validation, password management)
- **ADR-004**: MongoDB for Application Authorization and Business Entities (Flexible event schemas)
- **ADR-005**: Supabase Storage for Files and Binary Assets (Zero binaries in MongoDB)
- **ADR-006**: Asynchronous Background Jobs for Heavy Operations (> 50 items)
- **ADR-007**: Container-Safe Native Sharp Rasterization over Headless Chromium
- **ADR-008**: Render 512MB RAM Optimization: Disabled Cache and Thread Concurrency
- **ADR-009**: Bundled Devanagari OpenType Fonts for Deterministic Text Shaping
- **ADR-010**: Opaque 64-Character Verification Tokens without PII
- **ADR-011**: Atomic Conditional Check-In for Concurrency and Double-Scan Prevention
- **ADR-012**: Dynamic Column Header Mapping for Excel Imports
- **ADR-013**: First-Scan Name Assignment for Unassigned Worker Passes
- **ADR-014**: Visual Identity in Obsidian and Emerald (Strict Prohibition of Purple)
