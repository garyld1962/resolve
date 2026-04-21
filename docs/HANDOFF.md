# Resolve — Hand-off Document

**As of:** 2026-04-20
**State:** M0–M5 shipped. M5.5 (amendment lifecycle + deferred MCP tools) is the next milestone.
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
| M5 | MCP server | 5 tools (record/commit/query/verify/impact) over streamable HTTP + bearer auth; `mcp-handler` adapter at `/api/mcp/[transport]`; exit criterion met end-to-end with Claude Code | [#4](https://github.com/garyld1962/resolve/pull/4) |

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
- `/api/mcp/[transport]` — MCP server (M5) — bearer-token-gated; streamable HTTP at `/api/mcp/mcp`

### What's NOT shipped yet

Per PRD §8:
- **M5.5 — Amendment lifecycle** (next milestone) — schema for `amends` / `superseded_by` + the two deferred MCP tools (`amend_decision`, `supersede_decision`). Carved out of M5 during brainstorming so the MCP server could ship with a 5-tool scope.
- **M6 — Linear integration** (OAuth + bidirectional citation linking)
- **M7 — Deploy hardening** — Vercel deploy is already proven working, so this milestone may shrink considerably

Per PRD §5:
- **Supersession / amendment lifecycle** (PRD §5.1 second half + §5.2 `superseded_by` / `amends` columns) — deferred from M4, now folded into M5.5.
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
| MCP server | `mcp-handler` 1.1 + `@modelcontextprotocol/sdk` 1.29 | Streamable HTTP at `/api/mcp/mcp`; bearer-token auth via `withMcpAuth`; 5 tools wrap existing DB queries |
| Tests | vitest 4 | 68 tests (17 chain + 5 voyage + 4 search + 6 impact + 36 MCP — auth, schemas, wrap-tool, 5 tools, route-level integration) |

### Key design constraints (load-bearing — don't break)

1. **Lazy-init for any module that reads env at construction time.** Next 16's Turbopack evaluates modules at build time before runtime env is injected. See `src/db/client.ts:25` for the canonical pattern. Both `db` and `voyage/client.embed` follow it.
2. **Embed-on-commit runs OUTSIDE the chain transaction AND OUTSIDE the response path.** The chain transaction holds a per-project advisory lock (`src/db/queries/decisions.ts:131`); holding it across a Voyage HTTP call would serialize all commits. The embed runs via `after()` (Next.js server-only post-response hook) so the user sees commit confirmation immediately.
3. **HNSW partial index is `WHERE embedding IS NOT NULL`.** Keeps the index small while embed-on-commit catches up. Don't change to a full index.
4. **`server-only` shim for vitest + tsx.** `vitest.config.ts` aliases `server-only` to `src/test/server-only-shim.ts`; scripts use `tsconfig.scripts.json` for the same shim. Required because the real `server-only` package throws at import time outside Next.js bundles.
5. **Tag overlap uses drizzle's `arrayOverlaps` / `arrayContains`.** Inline `sql\`tags && ${array}\`` expands the JS array into a tuple → `text[] && record` error. Don't refactor away from the helpers.
6. **MCP streamable-HTTP path is `/api/mcp/mcp`, NOT `/api/mcp/http`.** `mcp-handler` derives its endpoint as `${basePath}/mcp`; with `basePath="/api/mcp"` the `[transport]` dynamic segment resolves to `mcp`. All smoke tests, `claude mcp add`, and client configs must use this path.
7. **MCP tool errors split between `ToolError` (business) and thrown exceptions (infra).** `wrapTool` returns `isError: true` with a stable `code` for `ToolError` instances so agents can branch; thrown exceptions propagate as MCP `InternalError`. Don't conflate the two (e.g., don't map zod validation failures to `NOT_FOUND`).

---

## Repo orientation

```
resolve/
├── docs/
│   ├── PRD.md                    # Product spec — milestones, requirements, schema
│   ├── DESIGN.md                 # Visual + component system
│   ├── HANDOFF.md                # ← this file
│   ├── m5-mcp-usage.md           # MCP server usage + exit-criterion transcript
│   └── plans/
│       ├── 2026-04-19-m3-search.md
│       ├── 2026-04-19-m4-cross-project.md
│       └── 2026-04-19-m5-mcp.md
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Decision List (home)
│   │   ├── chain/                # Chain Status
│   │   ├── cross-impact/         # Cross-Impact view (M4)
│   │   ├── decisions/[id]/       # Decision Detail + commit action
│   │   ├── decisions/new/        # Record Decision
│   │   ├── search/               # Search UI (M3)
│   │   └── api/
│   │       ├── search/           # /api/search route
│   │       └── mcp/[transport]/  # MCP server (M5) — route.ts + route.test.ts
│   ├── components/               # decision-card, hash-display, status-badge, technology-tag, impact-panel
│   ├── mcp/                      # M5: auth, schemas, wrap-tool, tools/{record,commit,query,verify,impact}
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
| `RESOLVE_MCP_TOKEN` | ✅ (sensitive) | ⚠️ **scoped to `feat/m5-mcp` only** | ✅ | 32-byte hex. Preview scoping is a CLI 51.5.0 workaround — see Caveats. Development can't be `--sensitive` (Vercel API constraint). |

### CI

- GitHub Actions workflow: `.github/workflows/` (CI step "check" runs typecheck, lint, test, build)
- All M2–M4 PRs merged with green CI

---

## Outstanding items (do soon)

### 🔴 Security / hygiene

1. **Rotate the leaked Voyage API key** — `pa-tTHOZ…` (full value was pasted into Claude Code conversation transcripts). Generate new at https://dash.voyageai.com/api-keys, then `vercel env rm`/`add` for all three envs, `vercel env pull`, redeploy.
2. **Rotate the leaked Vercel API token** — `vck_6V…` (also pasted to transcript). Delete at https://vercel.com/account/settings/tokens, generate new.
3. **Rotate `RESOLVE_MCP_TOKEN`** — leaked twice during M5 execution: once via RTK's grep wrapper formatting, once when `claude mcp add` echoed the `Authorization:` header to stdout. The second leak is the live value. User has a comprehensive keys-management solution in flight — fold all three rotations into it.

### 🟡 Operational

4. **Add `VOYAGE_API_KEY` to Vercel preview env.** Currently only Production + Development have it; PR previews of `/search` will fail until added: `vercel env add VOYAGE_API_KEY preview`. M5 preview smoked OK because `query_decisions` only hits Voyage when `query` is provided — tools/list and other tools don't.
5. **Verify the M4 production deploy** (browser smoke at `/cross-impact` and a Decision Detail page after the squashed `703464e` rolls out — check `vercel ls` for deploy state).
6. **Upgrade Vercel CLI to 51.8+** and re-add `RESOLVE_MCP_TOKEN` to preview as all-branches (currently scoped to `feat/m5-mcp` only). CLI 51.5.0 ignores `--yes` on the all-preview-branches form of `vercel env add`. Until upgraded, every new preview branch will 401 on `/api/mcp/mcp` until its own branch-scoped env is added.
7. **Exclude `/api/mcp/*` from Vercel deployment protection.** Production deployment protection currently double-gates the MCP route — Vercel SSO in front of our bearer auth — which makes the route uncallable by any external agent (the whole point of M5). Vercel → Project Settings → Deployment Protection → add a path-based exception for `/api/mcp/*`. Bearer auth (`RESOLVE_MCP_TOKEN`) remains the single gate. Confirmed live on production (`x-matched-path: /api/mcp/[transport]` returned 401 from `withMcpAuth` on 2026-04-21) but not curl-smokeable from outside the dashboard until the exception is added.

### 🟢 Roadmap

7. **M5.5 — Amendment lifecycle** (next milestone). Schema migration for `amends` / `superseded_by` columns on `decisions`, plus the two deferred MCP tools:
   - `amend_decision(id, rationale_delta, reason)` — appends an amendment to a committed decision; creates a new chain entry referencing the amended parent.
   - `supersede_decision(old_id, new_id, reason)` — marks `old_id` as superseded by `new_id`; both remain on-chain, queries can filter.
   - Also likely: `isAmendment` / `isSuperseded` query filters; UI affordances on Decision Detail to show amendment trail.

8. **M3.5 (informal):** consider adding tag tokens to the embed text. Reviewer flagged this in the M3 mid-execution review as a v1.1 tuning option — current embed is `title\n\nrationale` only. Including tags may improve recall but requires re-embedding all decisions.

9. **M4 tuning knob:** `IMPACT_MIN_SHARED_TAGS = 2` is hardcoded. If users complain about noise → raise to 3. If they say results feel sparse → lower to 1. One-line code change; no migration.

---

## Known caveats

- **Same DB across envs** — see Operational State above. Test data and prod data live together. The 3 baker-street seed decisions are visible in production today.
- **Baker-street seed uses dummy chain hashes** (`Buffer.alloc(32, 0xee)`) — they're `status='committed'` for query purposes but not part of the real M2 SHA-256 chain. The `/chain` page for baker-street will show placeholder hashes. Acceptable for seed data; the M2 chain is reserved for UI-recorded decisions.
- **Cross-project pair scan is O(n²) JS** — fine while committed-decision count is small (<10k). When this gets slow, push intersection into a Postgres recursive CTE or materialized view. See `src/db/queries/impact.ts:getCrossProjectImpactPairs` block comment.
- **Vercel CLI is 51.5.0** (latest 51.8.0). Two observed friction points:
  1. No multi-env flag on `vercel env add` — three separate calls per token.
  2. `vercel env add NAME preview --yes --sensitive --value X` still prompts for a branch even though the help text claims `--yes` skips it. Workaround used in M5: scope preview env to a specific git branch (`vercel env add NAME preview <branch> ...`).
- **`RESOLVE_MCP_TOKEN` fail-close**: if the env var is absent, `src/mcp/auth.ts` throws on every request (not silently 401). This surfaces misconfiguration loudly — helpful in preview/dev, and safe in production because the env var is auto-provisioned. Don't change to silent-401.
- **Preview deploys are behind Vercel deployment protection** — any external client hitting `/api/mcp/mcp` on a preview URL will get the HTML auth page before our bearer check even runs. Use `vercel curl --deployment <url>` for signed smokes, or configure a protection-bypass secret for agents that need direct preview access.

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
