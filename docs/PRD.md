# PRD: Resolve — Strategic Decision Log

| Field | Value |
|---|---|
| **Document status** | Draft v0.1 |
| **Last updated** | 2026-04-14 |
| **Owner** | Gary Davidson |
| **Stage** | Pre-scaffold — local development, cloud deployment imminent |
| **Related docs** | [`DESIGN.md`](./DESIGN.md) (visual + component system), [`README.md`](./README.md) |

---

## 1. Problem

Engineering teams ship decisions faster than they document them, and the places decisions *do* get written down are structurally wrong for recalling them later:

- **Commit messages** capture *what* changed, not *why* a path was chosen over its alternatives.
- **Linear issues** capture *what to do*, and close when the work ships — the rationale is archived with the ticket.
- **Slack / docs / ADRs** capture rationale unevenly, are not searchable across projects, and silently go stale when superseded.

The cost shows up in three recurring failures:

1. **Re-litigating settled choices.** Teams re-debate decisions every 6–12 months because no one can find the original reasoning.
2. **Cross-project contradiction.** A decision made in Project A (e.g., "standardize on NATS for messaging") is violated in Project B six months later because the second team never saw it.
3. **Agent amnesia.** AI coding agents (Claude Code, Baker Street) have no grounded, queryable memory of *the team's* architectural commitments — only of the current file they're editing.

There is no single system of record that is append-only, cross-project, cryptographically verifiable, AND directly queryable by both humans and agents.

## 2. Vision

Resolve is the **decision layer** that sits between Linear (work), the IDE (code), and agents (execution). Every strategic decision — architectural, product, operational — is recorded once, chained cryptographically, tagged with the technologies and projects it affects, and made queryable by semantic similarity.

Humans record and browse through a Linear-adjacent UI. Agents record and query through an MCP server. Both read the same append-only ledger.

**The one-line pitch:** *git log, but for the decisions behind the code — with AI that flags contradictions before you ship them.*

## 3. Goals & Non-Goals

### Goals (v1)

- G1. Record a decision in under 60 seconds with structured metadata (title, rationale, status, project, tags, linked Linear issues).
- G2. Guarantee tamper-evidence: every entry extends a SHA-256 hash chain with a periodic Merkle root.
- G3. Detect conflicts: when a new decision is proposed, surface semantically similar prior decisions and flag likely contradictions.
- G4. Cross-project impact radius: given a decision, show which other registered projects reference the same technologies or superseded decisions.
- G5. Agent-native: expose record / query / verify / link as MCP tools, usable by Claude Code and Baker Street without UI.
- G6. Linear bidirectional linking: a decision can cite Linear issues; a Linear issue can backlink to the decisions that govern it.

### Non-Goals (v1)

- Not a legal evidentiary system. "Tamper-evident" means *detectable tampering*, not court-admissible proof.
- Not a blockchain. No distributed consensus, no tokens, no external anchoring (that's a v2 consideration).
- Not a replacement for ADRs living in-repo. Resolve complements repo-local ADRs by making them cross-project and queryable.
- Not a generic wiki. Free-form pages belong in Notion/Obsidian; Resolve is structured decisions only.
- Not a compliance tool (SOC2, ISO, etc.). May inform one, but is not scoped for audit certification.
- No multi-tenant SaaS in v1. Single-org deployment (self-hosted or private Vercel/Supabase project).

## 4. Users & Use Cases

### Primary personas

- **Staff / principal engineer** — records architectural decisions, queries history before proposing new ones, uses Resolve to settle cross-team disputes.
- **Tech lead** — records project-level commitments, reviews impact radius before approving changes, links decisions to Linear initiatives.
- **AI agent (Claude Code, Baker Street)** — records decisions reached during pair-programming sessions, queries Resolve for context before generating code, cites decision IDs in its reasoning.

### Top use cases

| # | User | Job-to-be-done |
|---|---|---|
| UC1 | Staff engineer | "I'm proposing a messaging layer change — show me every prior messaging decision across all projects." |
| UC2 | Tech lead | "Record that we're dropping Redis for NATS JetStream in Baker Street, link the Linear epic, flag BuildFlow if it's affected." |
| UC3 | Claude Code agent | "Before I generate this migration, fetch all decisions tagged `postgres` or `drizzle` in this project." |
| UC4 | Staff engineer | "Verify the integrity of the chain for the last quarter — was anything retroactively edited?" |
| UC5 | Tech lead | "Supersede decision #42 with #87, preserving the history and marking #42 as superseded." |
| UC6 | Any user | "Semantic search: 'how did we handle eventual consistency last time?'" |

## 5. Functional Requirements

### 5.1 Decision lifecycle

- **States:** Proposed → Committed → (Amended | Superseded). Conflicting is a flag, not a state.
- **Proposed** decisions are mutable drafts; not yet chained.
- **Committed** decisions are hashed into the chain and immutable. Amendments create linked amendment records; they do not edit in place.
- **Superseded** decisions point forward to their replacement; both entries remain visible.

### 5.2 Decision record schema (initial)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `chain_position` | int | Monotonic within the chain |
| `title` | string | ≤ 120 chars |
| `rationale` | markdown | Main body |
| `status` | enum | proposed / committed / amended / superseded |
| `project_id` | fk | Registered project |
| `tags` | string[] | Technology tags, autocompleted |
| `linear_issue_ids` | string[] | Bidirectional links |
| `superseded_by` | fk? | Null unless superseded |
| `amends` | fk? | Null unless an amendment |
| `author` | string | Human or agent identity |
| `created_at` | timestamp | |
| `committed_at` | timestamp? | Null until committed |
| `content_hash` | sha256 | Hash of canonical content |
| `prev_hash` | sha256 | Prior chain entry's hash |
| `entry_hash` | sha256 | `sha256(content_hash ‖ prev_hash ‖ chain_position)` |
| `embedding` | vector(1024) | Voyage embedding of title + rationale |

### 5.3 Integrity chain

- Each committed decision extends the chain with `entry_hash` computed from its content and the previous entry.
- A Merkle root is computed nightly (and on-demand) over all committed entries; the root is displayed in the Chain Status view.
- A verify endpoint recomputes hashes end-to-end and reports any break.
- Amendments and supersessions are themselves chain entries — they do not mutate prior entries.

### 5.4 Cross-project impact

- Each decision is owned by one project but can reference others.
- "Impact radius" for decision D = set of decisions in other projects sharing ≥ N tags with D, plus decisions D supersedes or amends.
- Rendered as a graph in the Cross-Impact view and as a panel on the Decision Detail view.

### 5.5 Semantic search & conflict detection

- Every committed decision is embedded via Voyage and stored in pgvector.
- Search: cosine similarity top-K with filters for project, status, tags, date range.
- Conflict detection: when drafting a new decision, the top-K most similar prior decisions are shown; decisions with opposing stances on the same technology are flagged (heuristic in v1, LLM-assisted in v1.1).

### 5.6 MCP server (agent interface)

Tools exposed:
- `resolve.record_decision(project, title, rationale, tags, linear_issues, status="proposed")`
- `resolve.commit_decision(id)`
- `resolve.amend_decision(id, rationale_delta, reason)`
- `resolve.supersede_decision(old_id, new_id, reason)`
- `resolve.query_decisions(query, project?, tags?, status?, limit?)`
- `resolve.verify_chain(from?, to?)`
- `resolve.get_impact_radius(decision_id)`

### 5.7 Linear integration

- OAuth connection per-org, scoped to read issues and write comments.
- Decisions can cite Linear issues by ID or URL; citations resolve to issue title/status at render time.
- When a decision is committed with linked issues, Resolve posts a comment on each linked issue with the decision title and link.

### 5.8 UI screens (see `DESIGN.md` §6)

1. Decision List — filterable, multi-project aware
2. Decision Detail — rationale, chain entry, linked issues, impact radius
3. Record Decision — structured form with inline conflict check
4. Chain Status — Merkle root, verification state, recent entries
5. Cross-Impact — graph of decisions across projects
6. Search — semantic results with facets

## 6. Non-Functional Requirements

- **Latency:** list views < 300ms p95; semantic search < 800ms p95; chain verify (per 10k entries) < 5s.
- **Durability:** Supabase-managed Postgres with PITR; chain entries must survive any single-component failure.
- **Security:** Supabase Auth; row-level security on `project_id`; MCP auth via signed tokens.
- **Privacy:** self-hostable; no decision content leaves the user's Supabase project except for Voyage embedding calls (opt-out path exists for v1.1).
- **Accessibility:** WCAG AA; full keyboard navigation; respects `prefers-reduced-motion`.
- **Browser support:** evergreen Chromium, Firefox, Safari; mobile-web (read-only primary).

## 7. Architecture (target)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js App Router, React, Tailwind, shadcn/ui | Vercel-native, Linear-adjacent aesthetic |
| Design | Stitch MCP + `DESIGN.md` | Design system drives generated screens |
| Hosting | Vercel (preview per branch) | Minimal ops |
| DB | Supabase (Postgres + pgvector + Auth + RLS) | Managed, auth built-in, vector-ready |
| ORM | Drizzle | Migration-first, typed |
| Embeddings | Voyage AI | Higher retrieval quality than OpenAI small/ada at comparable cost |
| API surface | REST (Next.js route handlers) + MCP server | Humans + agents on parity |
| Integrations | Linear | Bidirectional linking |

## 8. Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 — Scaffold** | Next.js + Supabase + Drizzle wired locally | App boots, one migration applied, CI green |
| **M1 — Record & List** | Proposed/Committed lifecycle, Decision List, Decision Detail | Can record and view decisions; no chain yet |
| **M2 — Chain** | SHA-256 chain + Merkle root + Chain Status view | Verify endpoint detects tampering in test |
| **M3 — Search** | Voyage embeddings + semantic search + facets | Relevant top-K for seeded corpus |
| **M4 — Cross-project** | Impact radius + Cross-Impact graph | Two registered projects with linked decisions render correctly |
| **M5 — MCP** | MCP server with all v1 tools | Claude Code records and queries end-to-end |
| **M6 — Linear** | OAuth, citation resolution, back-comments | Decision commit posts Linear comment in dev workspace |
| **M7 — Deploy** | Vercel + Supabase production | Live URL, RLS verified, preview URLs per branch |

## 9. Risks & Open Questions

- **R1 — Conflict detection false positives.** Heuristic flagging will be noisy. *Mitigation:* make flags dismissible and measure dismiss rate as a signal for v1.1 LLM-assisted grading.
- **R2 — Embedding cost drift.** Voyage cost scales with decision volume. *Mitigation:* embed on commit only, not on edit; batch re-embeds.
- **R3 — Chain UX vs. utility.** Users may not care about Merkle roots. *Mitigation:* surface chain status unobtrusively; lead with integrity badges, not math.
- **R4 — Linear rate limits.** Bulk back-commenting could trip limits. *Mitigation:* queue + backoff; batch comment posting.
- **Q1 — Multi-tenant SaaS in v2?** Decide after self-hosted adoption signal.
- **Q2 — External chain anchoring?** Publishing Merkle roots to an external timestamper (OpenTimestamps, etc.) is out of scope for v1; revisit if compliance use cases emerge.
- **Q3 — Auth model for MCP.** Signed tokens in v1; org-scoped OAuth app for v1.1.

## 10. Success Metrics

- **Adoption:** ≥ 10 decisions recorded per active project per month by month 2 post-launch.
- **Recall:** ≥ 40% of recorded decisions are retrieved (viewed or queried) at least once within 90 days of commit.
- **Agent usage:** ≥ 25% of decisions are recorded via MCP (vs. UI) by month 3.
- **Conflict catch rate:** ≥ 1 genuine contradiction surfaced per 20 new decisions (qualitative review).
- **Integrity:** zero undetected chain breaks across verification runs.

## 11. Out of Scope for v1

- Mobile-native apps (web responsive only)
- Real-time collaborative editing of proposed decisions
- Exports to PDF / evidentiary formats
- Multi-org / SaaS billing
- Non-Linear issue trackers (Jira, GitHub Issues)
- External Merkle root anchoring
- On-prem / air-gapped deploys (self-hosted Supabase is sufficient)
