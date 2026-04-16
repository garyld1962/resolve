# Design System: Resolve — Strategic Decision Log

## 1. Visual Theme & Atmosphere

Resolve embodies a **precise, structured command center** that marries the clean utility of developer tooling with the authoritative clarity of a legal ledger. The interface feels **dense yet navigable**, designed for engineers who need to record, trace, and reason about decisions with cryptographic certainty.

The overall mood is **austere and trustworthy**, evoking the gravitas of an immutable audit trail while remaining approachable for daily use. The atmosphere draws from **Linear's refined minimalism** — a companion app that feels native alongside it — with subtle nods to blockchain ledger aesthetics through hash chain visualizations and integrity indicators.

**Key Characteristics:**
- Dark-mode-first interface with high-contrast data presentation
- Structured, tabular layouts that convey integrity and precision
- Monospace elements for hashes, timestamps, and chain references
- Clear visual hierarchy separating decision metadata from reasoning content
- Semantic status indicators for decision states (proposed, committed, amended, superseded)
- Multi-project aware: any number of registered projects, each with a dynamically assigned accent color
- Cross-project tracing visualized through subtle connection lines and impact radii

## 2. Color Palette & Roles

### Primary Foundation
- **Obsidian Surface** (#0A0A0F) — Primary background. Deep, near-black with a barely perceptible blue undertone that feels technical and trustworthy without being cold.
- **Slate Canvas** (#141419) — Secondary surface for cards, panels, and elevated containers. Subtle lift from the obsidian base.
- **Iron Panel** (#1C1C24) — Tertiary surface for nested content, sidebar backgrounds, and code blocks. Provides layered depth.

### Accent & Interactive
- **Integrity Emerald** (#10B981) — Primary accent for verified chain states, committed decisions, and successful operations. Conveys cryptographic validity and trust.
- **Reasoning Indigo** (#6366F1) — Secondary accent for AI-powered features: semantic search results, conflict detection highlights, and cross-project impact markers.
- **Linear Violet** (#5E6AD2) — Tertiary accent used sparingly for Linear integration touchpoints: linked issues, bidirectional sync indicators, and Linear-sourced metadata. Matches Linear's brand identity.

### Decision States
- **Proposed Amber** (#F59E0B) — Decisions in draft/proposed state awaiting commitment. Warm urgency without alarm.
- **Committed Emerald** (#10B981) — Decisions with completed SHA-256 hash chain entry. Integrity verified.
- **Amended Cyan** (#06B6D4) — Decisions that have been amended with tracked change history. Cool, informational.
- **Superseded Stone** (#78716C) — Deprecated decisions replaced by newer ones. Muted, recessive.
- **Conflicting Rose** (#F43F5E) — Decisions flagged by AI conflict detection. Demands attention.

### Typography & Text Hierarchy
- **Cloud White** (#E4E4E7) — Primary text for headlines, decision titles, and key content. High contrast on dark surfaces.
- **Silver Mist** (#A1A1AA) — Secondary text for descriptions, timestamps, metadata, and supporting content.
- **Zinc Whisper** (#52525B) — Tertiary text for labels, placeholders, and de-emphasized elements.
- **Hash Glow** (#34D399) — Monospace text for SHA-256 hashes, Merkle roots, and integrity chain values. Slightly luminous green on dark backgrounds.

### Borders & Structure
- **Steel Edge** (#27272A) — Primary border for cards, panels, and dividers. Barely visible structural separation.
- **Frost Line** (#3F3F46) — Secondary border for hover states, active panels, and focused elements.

## 3. Typography Rules

**Primary Font Family:** Geist Sans
**Character:** Clean geometric sans-serif matching Linear's typographic voice. Precise, modern, engineered.

**Monospace Font Family:** Geist Mono
**Character:** Used extensively for hashes, chain references, timestamps, and code. The monospace presence reinforces the cryptographic, engineering-forward identity.

### Hierarchy & Weights
- **Page Headlines (H1):** Semi-bold (600), 1.875rem, tight letter-spacing (-0.02em). Sparse — one per view.
- **Section Headers (H2):** Medium (500), 1.5rem, normal letter-spacing. Decision titles, panel headers.
- **Subsection Headers (H3):** Medium (500), 1.125rem. Field labels, metadata group titles.
- **Body Text:** Regular (400), 1rem, relaxed line-height (1.65). Decision rationale, context, and descriptions.
- **Metadata/Small:** Regular (400), 0.875rem, Silver Mist color. Timestamps, authors, chain positions.
- **Monospace Data:** Geist Mono, Regular (400), 0.8125rem. SHA-256 hashes displayed truncated with expand-on-click.
- **Status Badges:** Medium (500), 0.75rem, uppercase, letter-spacing (0.05em). Compact, color-coded.

### Spacing Principles
- Tight line-height (1.4) for metadata and data-dense areas
- Relaxed line-height (1.65) for decision rationale and reasoning content
- Consistent 1.5rem vertical rhythm between related fields
- 3rem between major sections within a decision detail view

## 4. Component Stylings

### Buttons
- **Shape:** Slightly rounded corners (6px) — precise and engineered, not playful
- **Primary CTA:** Integrity Emerald (#10B981) background with Obsidian Surface text, 0.75rem vertical padding, 1.5rem horizontal
- **Secondary CTA:** Outlined with Frost Line (#3F3F46) border, transparent background, Cloud White text
- **Destructive:** Conflicting Rose (#F43F5E) background for supersede/revoke actions
- **Hover State:** Subtle brightness increase (110%), smooth 200ms transition
- **Focus State:** 2px ring in accent color with 2px offset for keyboard navigation

### Decision Cards
- **Corner Style:** Subtly rounded corners (8px) — crisp, structured
- **Background:** Slate Canvas (#141419) with Steel Edge (#27272A) 1px border
- **Left Edge Indicator:** 3px left border in the decision state color (Amber for proposed, Emerald for committed, etc.)
- **Shadow Strategy:** Flat by default. No shadows — depth communicated through background color steps
- **Internal Layout:** Title + status badge top row, technology tags row, rationale excerpt middle, metadata (author, date, chain position) bottom row
- **Hover Behavior:** Border shifts to Frost Line (#3F3F46), subtle background lightening

### Hash Chain Visualization
- **Chain Position:** Displayed as `#42` in Geist Mono with Hash Glow color
- **Hash Display:** Truncated to first 8 + last 4 characters with `...` separator, full hash on hover/click
- **Merkle Root:** Displayed in a dedicated monospace block with Integrity Emerald left accent
- **Verification Badge:** Small shield icon in Emerald for verified entries, Rose for broken chain

### Impact Radius Panel
- **Style:** Right sidebar or expandable drawer showing cross-project decision connections
- **Connection Lines:** Dotted lines in Reasoning Indigo connecting related decisions
- **Project Tags:** Small pills with dynamically assigned project colors. Each registered project gets a unique accent from a rotating palette: Indigo, Amber, Cyan, Rose, Violet, Emerald, Orange, Fuchsia. Project color is assigned on first registration and persists.
- **Project Selector:** Dropdown or multi-select filter to scope the view to specific projects or see all
- **Severity Indicators:** Concentric circles showing impact magnitude

### Navigation
- **Style:** Left sidebar with icon + label pairs, matching Linear's navigation density
- **Typography:** Medium weight (500), 0.875rem, Cloud White for active, Zinc Whisper for inactive
- **Active State:** Reasoning Indigo (#6366F1) left accent bar (2px), slightly lighter background
- **Sections:** Decisions, Search, Chain Status, Cross-Impact, Settings
- **Mobile:** Bottom tab bar with 5 primary actions

### Inputs & Forms
- **Stroke Style:** 1px border in Steel Edge (#27272A)
- **Background:** Iron Panel (#1C1C24)
- **Corner Style:** Matching button roundness (6px)
- **Focus State:** Border transitions to Reasoning Indigo (#6366F1) with subtle glow
- **Text Color:** Cloud White for input text, Zinc Whisper for placeholders

### Technology Tags
- **Shape:** Pill-shaped (full radius), compact padding (0.25rem vertical, 0.625rem horizontal)
- **Style:** Outlined with Steel Edge border, transparent background, Silver Mist text. On hover, filled at 10% opacity of the tag's category color.
- **Typography:** Regular (400), 0.75rem, normal case — technology names displayed as-is (e.g., "Kubernetes", "NATS JetStream", "Drizzle ORM")
- **Category Colors:** Tags are grouped into broad categories with subtle color coding:
  - **Infrastructure** (Kubernetes, Docker, Traefik, ZFS) — Integrity Emerald (#10B981)
  - **Data** (Postgres, Qdrant, Redis, Drizzle) — Proposed Amber (#F59E0B)
  - **AI/ML** (Claude API, Voyage AI, Ollama, vLLM) — Reasoning Indigo (#6366F1)
  - **Frontend** (Next.js, React, Tailwind, shadcn/ui) — Amended Cyan (#06B6D4)
  - **Messaging** (NATS, WebSocket, SSE, MCP) — Linear Violet (#5E6AD2)
  - **Platform** (Vercel, OrbStack, WSL2) — Conflicting Rose (#F43F5E)
  - **Uncategorized** — Zinc Whisper (#52525B)
- **Behavior:** Autocomplete from existing tags on input. Free-text entry creates new tags. Tags are clickable to filter the decision list. Multiple tags per decision.
- **Tag Management:** Dedicated settings panel for merging duplicates, assigning categories, and aliasing (e.g., "K8s" → "Kubernetes")

### Status Badges
- **Shape:** Pill-shaped (full radius), compact padding (0.25rem vertical, 0.75rem horizontal)
- **Style:** Filled background at 15% opacity with full-opacity text in the status color
- **Typography:** Uppercase, 0.75rem, medium weight, expanded letter-spacing

## 5. Layout Principles

### Grid & Structure
- **Max Content Width:** 1200px for decision list views, 960px for decision detail views
- **Grid System:** CSS Grid with named areas — sidebar (240px fixed), main content (fluid), optional right panel (320px)
- **Decision List:** Single-column stack of decision cards with 0.75rem gap
- **Breakpoints:**
  - Mobile: <768px (sidebar collapses to bottom tabs)
  - Tablet: 768-1024px (sidebar overlay on demand)
  - Desktop: 1024-1440px (full three-panel layout)
  - Large Desktop: >1440px (centered with max-width constraint)

### Whitespace Strategy
- **Base Unit:** 4px micro-spacing, 8px component spacing, 16px section spacing
- **Card Internal Padding:** 1.25rem — tighter than editorial, denser data presentation
- **Between Cards:** 0.75rem — compact list density for scanning
- **Section Margins:** 2rem between major content groups
- **Sidebar Padding:** 1rem horizontal, 0.5rem vertical between nav items

### Data Density Philosophy
- **High-density by default:** Decision lists show title, status, date, chain position, and impact count in a single row
- **Progressive disclosure:** Click/expand for full rationale, hash details, and cross-impact analysis
- **Scannable metadata:** Consistent left-aligned labels with right-aligned values in detail views
- **Tabular precision:** Key metadata (hash, timestamp, author, project) in a structured 2-column grid

### Alignment & Visual Balance
- **Text Alignment:** Left-aligned throughout for maximum scanability
- **Visual Weight:** Status indicators and chain position on the left edge for instant recognition
- **Action Placement:** Primary actions (Record Decision, Amend) in top-right header area
- **Reading Flow:** Vertical scan of decision list → horizontal scan of decision detail

## 6. Design System Notes for Stitch Generation

When creating new screens for this project using Stitch, reference these specific instructions:

### Language to Use
- **Atmosphere:** "Precise, structured command center with cryptographic ledger aesthetics on a dark canvas"
- **Button Shapes:** "Slightly rounded corners with engineered precision" (not rounded-md)
- **Shadows:** "Flat, no shadows — depth through background color layering"
- **Spacing:** "Dense, data-forward layout with compact card gaps and tight metadata rows"
- **Typography:** "Geist Sans for UI, Geist Mono for hashes and chain data"

### Color References
Always use the descriptive names with hex codes:
- Primary Accent: "Integrity Emerald (#10B981)"
- AI Features: "Reasoning Indigo (#6366F1)"
- Linear Integration: "Linear Violet (#5E6AD2)"
- Backgrounds: "Obsidian Surface (#0A0A0F)" → "Slate Canvas (#141419)" → "Iron Panel (#1C1C24)"
- Text: "Cloud White (#E4E4E7)" → "Silver Mist (#A1A1AA)" → "Zinc Whisper (#52525B)"

### Component Prompts
- "Create a decision card with subtle rounded corners, dark slate background, 3px left border in the decision state color, showing title, status badge, and chain position"
- "Design a hash chain visualization with truncated SHA-256 in Geist Mono with luminous emerald glow on dark background"
- "Build a cross-project impact panel as a right drawer with dotted connection lines between related decisions, each project node colored by its assigned accent from a rotating palette"
- "Add a technology tag bar below the decision title: pill-shaped outlined tags with category-colored hover fills, autocomplete dropdown on input, clickable to filter"
- "Add a semantic search bar with dark iron background, subtle border, and Reasoning Indigo focus state, with a horizontal scrollable pill bar of technology tag filters above the results"

### Screen Sequence for MVP
1. **Decision List** — Primary view: filterable list of all decisions with status badges and chain positions
2. **Decision Detail** — Full decision view: rationale, metadata, hash chain entry, linked Linear issues, impact radius
3. **Record Decision** — Form view: structured input for new decisions with AI-assisted conflict checking
4. **Chain Status** — Dashboard: Merkle tree visualization, integrity verification status, recent chain entries
5. **Cross-Impact** — Graph view: visual map of decision relationships across all registered projects, with project-colored nodes and filterable scope
6. **Search** — Semantic search results powered by Voyage embeddings with relevance scoring. Supports faceted filtering by technology tags, project, status, and date range. Technology tag filter shown as a horizontal scrollable pill bar above results.
