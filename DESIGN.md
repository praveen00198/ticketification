# DESIGN.md — Design System & Visual Specification

## 1. Visual Philosophy
Ticketification employs a sleek, production-grade **Obsidian Dark & Vivid Emerald** aesthetic. The design conveys precision, technical authority, and event-day operational speed.

> [!IMPORTANT]
> **Strict Color Rule**:
> NEVER introduce random violet, purple, or indigo colors into the UI.
> The visual palette is anchored strictly around:
> - Deep Blacks & Charcoal Surface Layers
> - Vibrant Emerald Greens & Subtle Green Tints
> - High-contrast Neutral Grays for Typography & Borders
> - Dedicated Semantic Status Colors (Success=Green, Error=Crimson, Warning=Amber)

---

## 2. Color Palette & Tokens

### 2.1 Core Surfaces & Canvas
| Token | Hex Value | Purpose |
|---|---|---|
| `canvas-base` | `#09090b` (Zinc 950) | Full page viewport background |
| `surface-panel` | `#121215` | Cards, dashboard modules, dialog shells |
| `surface-elevated`| `#18181b` (Zinc 900) | Form inputs, dropdown menus, table headers |
| `surface-hover` | `#27272a` (Zinc 800) | Interactive row & button hover states |

### 2.2 Borders & Dividers
| Token | Value | Purpose |
|---|---|---|
| `border-subtle` | `rgba(255, 255, 255, 0.08)` / `#27272a` | Card outlines, table row dividers |
| `border-medium` | `rgba(255, 255, 255, 0.16)` / `#3f3f46` | Input borders, modal separators |
| `border-focus` | `#10b981` (Emerald 500) | Active input focus rings, selected cards |

### 2.3 Primary Accents (Emerald / Green Variants)
| Token | Hex Value | Purpose |
|---|---|---|
| `accent-primary` | `#10b981` (Emerald 500) | Primary CTA buttons, checkmarks, active toggles |
| `accent-hover` | `#059669` (Emerald 600) | Primary button hover state |
| `accent-subtle` | `rgba(16, 185, 129, 0.12)` | Badge backgrounds, active tab pills |
| `accent-border` | `rgba(16, 185, 129, 0.3)` | Badge borders, active card outlines |

### 2.4 Semantic Status Colors
| State | Text & Icon Hex | Background Hex | Border Hex |
|---|---|---|---|
| **Valid / Success** | `#10b981` (Emerald 500) | `rgba(16, 185, 129, 0.15)` | `rgba(16, 185, 129, 0.3)` |
| **Already Used / Error** | `#ef4444` (Red 500) | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.3)` |
| **Reusable / Notice** | `#f59e0b` (Amber 500) | `rgba(245, 158, 11, 0.15)` | `rgba(245, 158, 11, 0.3)` |
| **Neutral / Inactive** | `#a1a1aa` (Zinc 400) | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.1)` |

---

## 3. Typography

- **Primary Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
- **Code & Numeric Font Family**: `JetBrains Mono`, `Fira Code`, `monospace`

### Hierarchy & Scale
| Level | Font Size | Weight | Line Height | Tracking |
|---|---|---|---|---|
| **Display H1** | `32px` (`text-3xl`) | 800 (Extrabold) | 1.2 | `-0.02em` |
| **Section H2** | `24px` (`text-2xl`) | 700 (Bold) | 1.25 | `-0.01em` |
| **Card Title H3** | `18px` (`text-lg`) | 600 (Semibold) | 1.35 | `0` |
| **Body Regular** | `14px` (`text-sm`) | 400 (Regular) | 1.5 | `0` |
| **Body Semibold**| `14px` (`text-sm`) | 600 (Semibold) | 1.5 | `0` |
| **Caption / Meta**| `12px` (`text-xs`) | 500 (Medium) | 1.4 | `0.02em` |
| **Numeric Token** | `13px` (`text-xs`) | 600 (Semibold) | 1.2 | `0.05em` (`font-mono`) |

---

## 4. Components & Interactive Patterns

### 4.1 Buttons
- **Primary**: Background `bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold px-4 py-2 rounded-lg shadow-sm transition-all`.
- **Secondary**: Background `bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 px-4 py-2 rounded-lg transition-all`.
- **Destructive**: Background `bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg transition-all`.

### 4.2 Form Inputs
- Background `bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500`.

### 4.3 Data Tables
- Header: Sticky top, background `bg-zinc-900/90 backdrop-blur-sm text-zinc-400 font-semibold text-xs uppercase tracking-wider px-4 py-3 border-b border-zinc-800`.
- Row: Background `hover:bg-zinc-800/40 text-sm text-zinc-200 border-b border-zinc-800/60 transition-colors`.

### 4.4 Mobile-First Scanner Overlay
- High-contrast camera viewport with animated corner guide markers in emerald green (`#10b981`).
- Floating scan result card with instant visual color transition:
  - **Green flash + vibrate** on Valid Check-in.
  - **Red flash + error sound/vibrate** on Already Used or Wrong Event.
  - **Amber card** with input autofocus when Worker Name Assignment is triggered.

---

## 5. Responsive Breakpoints
- **Mobile (`< 640px`)**: Full-width cards, stack action headers, mobile scanner controls maximized to viewport height, horizontal table scrolling with indicators.
- **Tablet (`640px - 1024px`)**: 2-column dashboard metric grids, compact side navigation.
- **Desktop (`> 1024px`)**: Expanded navigation sidebar, multi-column analytics, full data tables.
