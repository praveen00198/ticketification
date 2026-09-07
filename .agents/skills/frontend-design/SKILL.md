---
name: frontend-design
description: Design system rules, visual tokens, and UI/UX standards for Ticketification. Use when styling or designing UI components.
---

# Frontend Design Skill — Ticketification

## Purpose
Enforces the visual identity, typography, layout principles, and color governance for the Ticketification platform.

## When to Use
- Implementing or modifying UI components, layouts, pages, modals, tables, or buttons.
- Auditing visual consistency and dark-theme aesthetic compliance.

## Color Palette & Token Governance
> [!IMPORTANT]
> Strict Color Rule: NEVER introduce random violet, indigo, or purple colors.
> The visual identity is anchored exclusively around:
> - **Deep Blacks & Neutral Charcoal Shades** (Canvas backgrounds, surface containers, card panels)
> - **Emerald Green & Vivid Green Variants** (Primary CTA buttons, active states, valid scan badges, accents)
> - **Neutral Borders & Typography** (Zinc/Slate scales for borders, subheaders, captions)
> - **Functional Status Colors** (Amber for warnings/reusable worker notes, Crimson Red for errors/invalid scans)

### Canonical Color Tokens
- `bg-base`: `#09090b` (Deepest charcoal/black canvas)
- `bg-surface`: `#121215` (Card & modal background)
- `bg-surface-elevated`: `#18181b` (Inputs, dropdowns, table headers)
- `border-subtle`: `rgba(255, 255, 255, 0.08)` or `#27272a`
- `border-strong`: `rgba(255, 255, 255, 0.16)` or `#3f3f46`
- `accent-green`: `#10b981` (Emerald 500)
- `accent-green-hover`: `#059669` (Emerald 600)
- `accent-green-subtle`: `rgba(16, 185, 129, 0.12)`
- `status-success`: `#10b981` / `rgba(16, 185, 129, 0.15)`
- `status-error`: `#ef4444` / `rgba(239, 68, 68, 0.15)`
- `status-warning`: `#f59e0b` / `rgba(245, 158, 11, 0.15)`
- `text-primary`: `#f4f4f5` (Zinc 100)
- `text-secondary`: `#a1a1aa` (Zinc 400)
- `text-muted`: `#71717a` (Zinc 500)

## Typography
- **Primary Body & Display**: `Inter`, `-apple-system`, `sans-serif`
- **Monospace / Numerical / Sequence IDs**: `JetBrains Mono`, `monospace`
- Font sizing must use standard Tailwind sizing (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`).
- High contrast: Avoid low-contrast text on dark backgrounds. Ensure minimum WCAG AA ratio (4.5:1).

## Layout & Responsive Principles
1. **Mobile-First Scanner**: Scanner viewport must be responsive, centering camera feed and floating status cards cleanly on mobile viewports (360px - 430px).
2. **Tables & Grids**: Use horizontal scroll wrappers or responsive card transforms on small screens for guest and ticket tables.
3. **Micro-Animations**: Smooth transitions on hover (`transition-colors duration-150`, `transition-transform duration-150`).
4. **No Placeholders**: Never render broken layout boxes or unstyled placeholder states. Use clean skeleton loaders with subtle pulse.

## Common Mistakes to Avoid
- Adding indigo or purple gradients.
- Using unstyled native alerts or raw browser prompts.
- Hardcoding inconsistent hex values in component style tags instead of standardized Tailwind tokens.
- Hiding scanner camera controls behind desktop-only fixed dimensions.

## Verification Checklist
- [ ] No purple/violet/indigo hex codes or Tailwind classes.
- [ ] Responsive across mobile (375px), tablet (768px), and desktop (1280px+).
- [ ] Standardized status badges (Success=Green, Already Used=Red, Reusable=Amber, Error=Red).
