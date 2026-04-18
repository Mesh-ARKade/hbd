# Mesh ARKade — DAT Pipeline Dashboard
### Design Document · v1.0 · April 2026

---

## 1. Overview

The **DAT Pipeline Dashboard** (`dat_pipeline.html`) is a single-page control panel for monitoring the Mesh ARKade preservation pipeline. It tracks the real-time progress of DAT file ingestion from multiple ROM preservation sources — from fetch through sort to parse — and commits the results to a database.

The design is **self-contained** (one HTML file, no build step) and built to feel like an authentic archival operations terminal: dark, data-dense, and technically precise — but with personality.

---

## 2. Brand & Color Palette

All colors are derived **exclusively** from the master `ARKade.svg` icon. No external palette was introduced.

| Token | Hex | Source | Usage |
|---|---|---|---|
| `--icon-red` | `#f01532` | Icon diamond fill | Errors, destructive states |
| `--icon-navy` | `#0e3754` | Icon body fill | Completed states, depth backgrounds |
| `--icon-teal` | `#33afa9` | Icon teal stripe | Active processing, primary accent |
| `--icon-cyan` | `#c9f1f2` | Icon cyan panel | Completed labels, secondary accent |
| `--icon-white` | `#fcfdfa` | Icon white screen | Body text, active labels |
| `--bg-dark` | `#050505` | — | Page background |

### Background Texture
A subtle **dot-grid** is applied to the page body:
```css
background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0);
background-size: 40px 40px;
```
This adds visual depth without competing with content.

---

## 3. Typography

Three typefaces are used with distinct, intentional roles:

| Font | Weight | Role |
|---|---|---|
| **Outfit** | 900 (Black) | Primary display headings (`ARKive`), card source names |
| **Press Start 2P** | 400 | Personality/retro label (`How 'Bout DAT!?`) |
| **Space Grotesk** | 300–900 | Body copy, nav labels, descriptions |
| **Outfit** | 300 (Light) | Subheadings, descriptive paragraphs |

All fonts are loaded via Google Fonts (CDN). No system fonts used in primary UI.

### Header Lockup
The page header is a **horizontal lockup**: the full `ARKade.svg` icon sits to the left, scaled to match the combined height of both text lines. This creates a strong brand anchor for the dashboard.

- Line 1: `ARKive` — `Outfit Black`, large display size
- Line 2: `How 'Bout DAT!?` — `Press Start 2P`, smaller, accent teal `#33afa9`

---

## 4. Layout & Structure

### Navigation Bar
- Fixed, pill-shaped (`border-radius: 9999px`), centered at top
- Frosted glass: `backdrop-blur-xl`, `bg-[#050505]/70`
- Contains: `ARKade.svg` icon + brand name | Nav links | System status indicator
- Active page underlined with teal `border-b-2 border-[#33afa9]`

### Page Layout
```
┌─────────────────────────────────────────┐
│  [NAV BAR — fixed pill]                 │
├─────────────────────────────────────────┤
│  [STATUS TAG]  [SYNC STATUS]            │
│  [ICON] ARKive                          │
│         How 'Bout DAT!?                 │
│  [Subheading description]               │
├──────────────────┬──────────────────────┤
│  SOURCE CARD     │  SOURCE CARD         │
│  (No-Intro)      │  (Redump)            │
├──────────────────┼──────────────────────┤
│  SOURCE CARD     │  SOURCE CARD         │
│  (Tosec)         │  (MAME)              │
└──────────────────┴──────────────────────┘
```
- Max content width: `1152px` (`max-w-6xl`)
- Grid: `1-column` on mobile, `2-column` on `lg+` breakpoint

---

## 5. Component Library

### Glass Card (Source Panel)
The primary UI unit. Each source gets one card.

```css
background: rgba(252, 253, 250, 0.02);
border: 1px solid rgba(252, 253, 250, 0.06);
border-radius: 1rem;
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

**Hover state:** border shifts to `--icon-teal`, card lifts `translateY(-4px)`.  
**Error hover state:** border shifts to `--icon-red`.

### Progress Track
3px high track, full-width, rounded. Color-coded fill by state:

| State | Fill Color |
|---|---|
| Completed | `--icon-navy` → fades to `--icon-teal` on final step |
| Active | `--icon-cyan` (pulsing label) |
| Pending | Transparent (track visible, no fill) |
| Failed | `--icon-red` |

### Step Labels (`.step-label`)
Uppercase, widely tracked (`letter-spacing: 0.15em`), `Outfit` font.

| Class | Color | Meaning |
|---|---|---|
| *(default)* | `rgba(252,253,250, 0.3)` | Pending |
| `.active` | `--icon-white` + bold | Currently running |
| `.completed` | `--icon-cyan` | Done successfully |
| `.failed` | `--icon-red` + bold | Error state |

### Status Badge (top-right of each card)

| State | Style |
|---|---|
| Processing | Teal bg/border + pulsing dot |
| Idle/Synced | Neutral bg + checkmark icon |
| Error | Red bg/border + solid dot |
| Initializing | White bg/border + spinner icon |

### Status Tag (page header)
```css
background: var(--icon-teal);
color: var(--bg-dark);
font-weight: 900;
text-transform: uppercase;
letter-spacing: 0.1em;
```

---

## 6. Pipeline States (Data Model)

Each source card renders one of four pipeline states:

| State | Description | Example Source |
|---|---|---|
| **Processing** | One phase actively running | No-Intro (Sort: 68%) |
| **Synced** | All 3 phases complete, DB committed | Redump (100%/100%/100%) |
| **Error** | A phase failed, pipeline blocked | Tosec (Sort failed at 92%) |
| **Initializing** | Fetch phase starting, no data yet | MAME (Fetch: 15%) |

The error state includes an inline error log:
```
ERR: Invalid XML format near line 4591. Unexpected token.
```
Styled as a red left-border code block.

---

## 7. Special Effects

### Scanline Overlay
Applied to the MAME card as a nod to arcade CRT aesthetics:
```css
.scanlines::after {
    background: linear-gradient(rgba(5,5,5,0) 50%, rgba(0,0,0,0.2) 50%);
    background-size: 100% 4px;
}
```

### Icon Glow (Header only)
```css
filter: drop-shadow(0 0 10px rgba(51, 175, 169, 0.2));
```
Applied **only** to the large header icon. The navbar icon uses a plain `<img>` tag with no filter to preserve original SVG colors.

---

## 8. File Structure

```
c:\ag-workspace\logo-design\
├── dat_pipeline.html     ← This dashboard (self-contained)
├── ARKade.svg            ← Master icon (referenced via <img>)
└── ARKade.png            ← Raster fallback (not used here)
```

> [!NOTE]
> `dat_pipeline.html` is **not** fully self-contained — it references `ARKade.svg` via a relative `<img>` tag. Both files must be co-located to render correctly. For a truly portable single file, the SVG contents can be inlined.

---

## 9. Future Considerations

- **Live data**: Replace static progress values with a WebSocket or polling `fetch()` call to a pipeline API
- **Expandable cards**: Click a source card to expand a full log view
- **Add/Remove sources**: A UI to configure which DAT sources are tracked
- **Dark/Light mode**: Foundation is in place; a light mode variant could use `--icon-white` as background with `--icon-navy` text
- **Self-contained export**: Inline the SVG to make the file fully portable with no external dependencies
