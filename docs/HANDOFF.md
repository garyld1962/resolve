# Resolve — Hand-off Document

**As of:** 2026-04-19
**State:** M0–M4 shipped to production. M5 (MCP) is the next milestone.
**Owner:** Gary Davidson

---

## What this is

Resolve is the **decision layer** that sits between Linear (work), the IDE (code), and agents (execution). Every strategic decision — architectural, product, operational — is recorded once, chained cryptographically, tagged with the technologies and projects it affects, and made queryable by semantic similarity.

One-line pitch: *git log, but for the decisions behind the code — with AI that flags contradictions before you ship them.*

For the full vision, problem framing, and milestone roadmap see [`PRD.md`](./PRD.md).

---

## Current state (what works today)

### Shipped milestones

| | Milestone | What it gave us | PR |
|---|---|---|---|
| M0 | Scaffold | Next.js 16 + Drizzle + Supabase wired locally; CI green | direct |
| M1 | Record + Commit + List | Proposed → Committed lifecycle; Decision List + Detail | direct |
| M2 | Chain | SHA-256 hash chain + Merkle root + tamper-evident `verifyChain` | [#1](https://github.com/garyld1962/resolve/pull/1) |
| M3 | Search | Voyage embeddings (`voyage-3-large`, 1024-d) + pgvector + `/search` page with facets | [#2](https://github.com/garyld1962/resolve/pull/2) |
| M4 | Cross-project | Tag-overlap impact radius; Decision Detail panel + `/cross-impact` view; second seeded project | [#3](https://github.com/garyld1962/resolve/pull/3) |

### Live URLs

- **Production:** https://resolve-gary-davidsons-projects.vercel.app *(behind Vercel deployment protection — log in via Vercel SSO to view)*
- **Production alias:** also https://resolve-two-iota.vercel.app
- **Preview deploys:** auto-created per PR

### Deployed routes

- `/` — Decision List (home)
- `/decisions/[id]` — Decision Detail with chain entry + cross-project impact panel
- `/decisions/new` — Record Decision form
- `/chain` — Chain Status (Merkle root + verification state)
- `/search` — semantic search (M3) — needs `VOYAGE_API_KEY` env
- `/cross-impact` — cross-project pair view (M4)
- `/api/search` — REST search endpoint

### What's NOT shipped yet

Per PRD §8:
- **M5 — MCP server** (next milestone)
- **M6 — Linear integration** (OAuth + bidirectional citation linking)
- **M7 — Deploy hardening** — Vercel deploy is already proven working, so this milestone may shrink considerably

Per PRD §5:
- **Supersession / amendment lifecycle** (PRD §5.1 second half + §5.2 `superseded_by` / `amends` columns) — deferred from M4. Schema work; deserves its own milestone.
- **Conflict detection** (PRD §5.5 second half — flag contradictory decisions on same tech) — deferred from M3.
- **Force-directed graph layout** for `/cross-impact` — v1 is columnar list; real graph is v1.1.

---

## Architecture (built)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16 App Router + React 19.2 + Tailwind 4 | Server components throughout; one client component (`search-form.tsx`) |
| Hosting | Vercel | Linked to GitHub repo; auto-deploys main + per-PR previews |
| DB | Supabase Postgres + pgvector 0.8.0 | Same instance for dev + prod (no isolation) |
| ORM | Drizzle 0.45 | Migrations in `drizzle/`; `vector(1024)` column + HNSW partial index |
| Embeddings | Voyage AI `voyage-3-large` (1024-d) | Lazy-init HTTP client; embed-on-commit via `next/server`'s `after()` |
| Tests | vitest 4 | 32 tests (17 chain + 5 voyage + 4 search + 6 impact) |

### Key design constraints (load-bearing — don't break)

1. **Lazy-init for any module that reads env at construction time.** Next 16's Turbopack evaluates modules at build time before runtime env is injected. See `src/db/client.ts:25` for the canonical pattern. Both `db` and `voyage/client.embed` follow it.
2. **Embed-on-commit runs OUTSIDE the chain transaction AND OUTSIDE the response path.** The chain transaction holds a per-project advisory lock (`src/db/queries/decisions.ts:131`); holding it across a Voyage HTTP call would serialize all commits. The embed runs via `after()` (Next.js server-only post-response hook) so the user sees commit confirmation immediately.
3. **HNSW partial index is `WHERE embedding IS NOT NULL`.** Keeps the index small while embed-on-commit catches up. Don't change to a full index.
4. **`server-only` shim for vitest + tsx.** `vitest.config.ts` aliases `server-only` to `src/test/server-only-shim.ts`; scripts use `tsconfig.scripts.json` for the same shim. Required because the real `server-only` package throws at import time outside Next.js bundles.
5. **Tag overlap uses drizzle's `arrayOverlaps` / `arrayContains`.** Inline `sql\`tags && ${array}\`` expands the JS array into a tuple → `text[] && record` error. Don't refactor away from the helpers.

---

## Repo orientation

```
resolve/
├── docs/
│   ├── PRD.md                    # Product spec — milestones, requirements, schema
│   ├── DESIGN.md                 # Visual + component system
│   ├── HANDOFF.md                # ← this file
│   └── plans/
│       ├── 2026-04-19-m3-search.md
│       └── 2026-04-19-m4-cross-project.md
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Decision List (home)
│   │   ├── chain/                # Chain Status
│   │   ├── cross-impact/         # Cross-Impact view (M4)
│   │   ├── decisions/[id]/       # Decision Detail + commit action
│   │   ├── decisions/new/        # Record Decision
│   │   ├── search/               # Search UI (M3)
│   │   └── api/search/           # /api/search route
│   ├── components/               # decision-card, hash-display, status-badge, technology-tag, impact-panel
│   ├── db/
│   │   ├── client.ts             # Lazy-init drizzle client
│   │   ├── seed.ts               # Idempotent seed: resolve + baker-street
│   │   ├── schema/               # projects, decisions
│   │   └── queries/              # chain, decisions, embeddings, search, impact, projects
│   ├── lib/
│   │   ├── chain/                # canonicalize, hash, extend, merkle, verify
│   │   ├── voyage/               # lazy-init HTTP client (embed)
│   │   └── default-project.ts    # DEFAULT_PROJECT_SLUG = "resolve"
│   └── test/server-only-shim.ts  # vitest alias target
├── scripts/
│   ├── backfill-embeddings.ts    # `pnpm db:backfill-embeddings`
│   └── tamper.ts                 # M2 chain-tamper test harness (gitignored)
├── drizzle/                      # Migrations 0000–0004
├── tsconfig.scripts.json         # Script-only tsconfig (server-only shim)
└── vitest.config.ts              # Test config (also aliases server-only)
```

---

## Local dev quick start

```bash
git clone https://github.com/garyld1962/resolve.git && cd resolve
pnpm install
vercel link                                 # link to gary-davidsons-projects/resolve
vercel env pull .env.local                  # pull dev env (Supabase + Voyage keys)
pnpm db:migrate                             # apply any pending migrations
pnpm db:seed                                # seed projects + sample decisions; auto-runs embedding backfill
pnpm dev                                    # http://localhost:3000
```

### Useful scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start Next dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | vitest (full suite) |
| `pnpm test:watch` | vitest in watch mode |
| `pnpm db:generate` | Generate migration from schema diff |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema to DB without migration (dev only) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed` | Idempotent seed; auto-runs `db:backfill-embeddings` |
| `pnpm db:backfill-embeddings` | Embed any committed decisions with NULL embedding |

---

## Operational state

### Vercel project

- Org: `gary-davidsons-projects`
- Project: `resolve`
- Project ID: stored in `.vercel/project.json` (committed)
- Production deploy protection: **ON** (Vercel SSO required to view URLs)

### Database

- Supabase Postgres at `db.tqvmqwvqalknlvbvonsa.supabase.co/postgres`
- **Same DB serves both dev and production environments.** Migrations applied locally affect prod immediately. Worth revisiting if multi-tenant isolation matters in a future milestone.
- Extensions: `pgvector` 0.8.0 (M3)
- Migrations applied: 0000–0004
- Current data: 5 committed decisions across 2 projects (2 in `resolve`, 3 in `baker-street`), all embedded

### Environment variables

| Var | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `POSTGRES_URL` | ✅ | ✅ | ✅ | Pooled (PgBouncer port 6543) — runtime |
| `POSTGRES_URL_NON_POOLING` | ✅ | ✅ | ✅ | Direct port 5432 — migrations + scripts |
| Other `POSTGRES_*` | ✅ | ✅ | ✅ | Auto-provisioned by Supabase Marketplace integration |
| `VOYAGE_API_KEY` | ✅ | ❌ **MISSING** | ✅ | **Add to preview before next M3-touching PR or `/search` will 500 in previews** |

### CI

- GitHub Actions workflow: `.github/workflows/` (CI step "check" runs typecheck, lint, test, build)
- All M2–M4 PRs merged with green CI

---

## Outstanding items (do soon)

### 🔴 Security / hygiene

1. **Rotate the leaked Voyage API key** — `pa-tTHOZ…` (full value was pasted into Claude Code conversation transcripts). Generate new at https://dash.voyageai.com/api-keys, then `vercel env rm`/`add` for all three envs, `vercel env pull`, redeploy.
2. **Rotate the leaked Vercel API token** — `vck_6V…` (also pasted to transcript). Delete at https://vercel.com/account/settings/tokens, generate new.
3. User has indicated a comprehensive keys-management solution is in flight — once that lands, fold both rotations into it.

### 🟡 Operational

4. **Add `VOYAGE_API_KEY` to Vercel preview env.** Currently only Production + Development have it; PR previews of `/search` will fail until added: `vercel env add VOYAGE_API_KEY preview`.
5. **Verify the M4 production deploy** (browser smoke at `/cross-impact` and a Decision Detail page after the squashed `703464e` rolls out — check `vercel ls` for deploy state).

### 🟢 Roadmap

6. **M5 — MCP server** (next milestone). PRD §5.6 defines the tool surface:
   - `resolve.record_decision(project, title, rationale, tags, linear_issues, status="proposed")`
   - `resolve.commit_decision(id)`
   - `resolve.amend_decision(id, rationale_delta, reason)` — depends on amendment lifecycle (deferred from M4)
   - `resolve.supersede_decision(old_id, new_id, reason)` — same dependency
   - `resolve.query_decisions(query, project?, tags?, status?, limit?)`
   - `resolve.verify_chain(from?, to?)`
   - `resolve.get_impact_radius(decision_id)`
   - Plus auth model (signed tokens v1, OAuth in v1.1 per PRD Q3).
   - First milestone where Resolve gains an external agent-facing API surface — materially different from M0–M4.

7. **M3.5 (informal):** consider adding tag tokens to the embed text. Reviewer flagged this in the M3 mid-execution review as a v1.1 tuning option — current embed is `title\n\nrationale` only. Including tags may improve recall but requires re-embedding all decisions.

8. **M4 tuning knob:** `IMPACT_MIN_SHARED_TAGS = 2` is hardcoded. If users complain about noise → raise to 3. If they say results feel sparse → lower to 1. One-line code change; no migration.

---

## Known caveats

- **Same DB across envs** — see Operational State above. Test data and prod data live together. The 3 baker-street seed decisions are visible in production today.
- **Baker-street seed uses dummy chain hashes** (`Buffer.alloc(32, 0xee)`) — they're `status='committed'` for query purposes but not part of the real M2 SHA-256 chain. The `/chain` page for baker-street will show placeholder hashes. Acceptable for seed data; the M2 chain is reserved for UI-recorded decisions.
- **Cross-project pair scan is O(n²) JS** — fine while committed-decision count is small (<10k). When this gets slow, push intersection into a Postgres recursive CTE or materialized view. See `src/db/queries/impact.ts:getCrossProjectImpactPairs` block comment.
- **Vercel CLI was 51.5.0 at session start** (latest 51.7.0). Not blocking but the older CLI requires `vercel env add NAME ENV` per environment (no multi-env flag). Upgrade with `npm i -g vercel@latest`.

---

## How decisions about Resolve get made

This is the recursive bit: the meta-process for changing Resolve itself.

1. **Plan files** live in `docs/plans/YYYY-MM-DD-<feature>.md` (see M3, M4 examples). Format is TDD-task-style with checkboxes — readable as a contract by both humans and the executing agent.
2. **Each milestone gets a PR.** Title prefixed `M{N}: ...`. Squash-merged. Single commit on `main`.
3. **Mid-execution code review** at a natural seam (M3 had one after the data-layer work, before UI). Catches issues cheaper than a full end-of-PR review.
4. **Architectural decisions are recorded in commit messages and PR descriptions** — eventually they should also be recorded in Resolve itself (recursive bootstrapping). Currently the seeded "Adopt Supabase…" and "Use advisory xact locks…" decisions are the only ones doing this.

---

## Pointers to the PRD

| Question | Where to look |
|---|---|
| What's the v1 vision? | `docs/PRD.md` §2 |
| What's a decision record? | §5.2 (schema) |
| How does the chain work? | §5.3 |
| How does cross-project work? | §5.4 |
| How does search work? | §5.5 |
| What MCP tools are planned? | §5.6 |
| What's Linear integration? | §5.7 |
| What screens does the UI need? | §5.8 + `docs/DESIGN.md` §6 |
| What's the milestone roadmap? | §8 |
| What are the success metrics? | §10 |
| What's NOT in v1? | §11 |
