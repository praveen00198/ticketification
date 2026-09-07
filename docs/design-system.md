# Design System & Visual Architecture

## Visual Identity: Operational Event Console
The design prioritizes **clarity, speed, hierarchy, and confidence** — this is a tool for event operators, not a marketing site.

## Color System

### Semantic Colors
| Token | Hex | Usage |
|---|---|---|
| `--color-surface-bg` | `#FAFAF9` | Page background |
| `--color-surface-card` | `#FFFFFF` | Cards, panels |
| `--color-surface-border` | `#E4E4E7` | Card borders, dividers |
| `--color-text-primary` | `#18181B` | Primary text, headings |
| `--color-text-secondary` | `#71717A` | Secondary text, labels |
| `--color-text-muted` | `#A1A1AA` | Placeholder text, disabled |
| `--color-accent` | `#18181B` | Primary actions (dark, confident) |
| `--color-success` | `#10B981` | Valid, active, success states |
| `--color-warning` | `#F59E0B` | Warnings, attention needed |
| `--color-danger` | `#EF4444` | Errors, invalid, destructive |
| `--color-info` | `#3B82F6` | Informational |

### Status Colors
| Status | Color | Token |
|---|---|---|
| ACTIVE | Emerald | `--color-success` |
| USED | Amber | `--color-warning` |
| CANCELLED | Red | `--color-danger` |
| VALID | Emerald | `--color-success` |
| ALREADY_USED | Amber | `--color-warning` |
| INVALID | Red | `--color-danger` |
| UNASSIGNED | Slate | `--color-text-secondary` |

## Typography
Font: System font stack (no external font dependency for the admin UI).

| Role | Size | Weight | Usage |
|---|---|---|---|
| Display | 28px / 1.75rem | 700 | Page titles |
| Heading | 20px / 1.25rem | 600 | Section headings |
| Subheading | 16px / 1rem | 600 | Card titles |
| Body | 14px / 0.875rem | 400 | Default text |
| Label | 12px / 0.75rem | 500 | Form labels, badges |
| Caption | 11px / 0.6875rem | 400 | Timestamps, metadata |
| Data | 13px / 0.8125rem | 500 | Table cells |

## Spacing Scale
4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

## Radius
- Small: 6px (inputs, badges)
- Medium: 8px (cards, buttons)
- Large: 12px (modals, panels)
- Full: 9999px (pills)

## Shadow
- Card: `0 1px 3px rgba(0,0,0,0.06)`
- Elevated: `0 4px 12px rgba(0,0,0,0.08)`
- Modal: `0 16px 48px rgba(0,0,0,0.12)`

## Icon System
**Remix Icon** — single icon library, consistent sizing.
- Default size: 18px
- Large: 24px
- Action buttons: 20px
- Use line style for navigation, fill for status indicators

## Component Patterns
- **Buttons**: Primary (dark bg), Secondary (bordered), Ghost (text-only), Danger (red)
- **Inputs**: Bordered, labeled, with validation states
- **Tables**: Clean, sortable headers, row hover, status badges
- **Badges**: Pill-shaped, color-coded by status
- **Modals**: Centered overlay, clear title, primary+cancel actions
- **Toast**: Bottom-right, auto-dismiss, color-coded
- **Empty States**: Illustration/icon + descriptive message + action button

## Scanner States
- **Scanning**: Camera active, subtle pulse border
- **Valid**: Green border flash, large checkmark, guest info
- **Already Used**: Amber border, warning icon, previous check-in time
- **Invalid**: Red border, error icon, clear message
- **Worker Unassigned**: Blue border, name input form
- **Success**: Green confirmation, auto-reset to scanning

## Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px–1024px
- Desktop: > 1024px
- Scanner: Mobile-first, optimized for portrait phones
