# M5 — MCP Server Design

**Date:** 2026-04-19
**Status:** design approved; implementation plan pending
**PRD ref:** [§5.6 MCP server](../PRD.md#56-mcp-server-agent-interface), [§8 M5 row](../PRD.md#8-milestones), [§10 success metric "≥25% decisions via MCP"](../PRD.md#10-success-metrics), [§9 Q3 auth](../PRD.md#9-risks--open-questions)

---

## Goal

Ship the first agent-callable surface for Resolve: an HTTP MCP server exposing 5 tools over the existing query layer, hosted as a Next.js route on the same Vercel deployment that serves the UI. When M5 ships, a developer in Claude Code can record decisions, commit them, query them semantically or by filter, verify the chain, and pull cross-project impact — all without leaving the IDE.

**Exit criterion (from PRD §8):** Claude Code records and queries end-to-end.

---

## Executive summary

`mcp-handler` (the published name of `@vercel/mcp-adapter`) mounts an MCP server at `POST /api/mcp/[transport]`. `withMcpAuth` wraps the handler with bearer-token authentication — single shared token in `RESOLVE_MCP_TOKEN`. Five tool wrappers under `src/mcp/tools/` delegate to existing `src/db/queries/*` functions. No new business logic; the MCP layer is a thin protocol adapter over proven code.

Two tools from PRD §5.6 — `amend_decision` and `supersede_decision` — are **not shipped in M5**. They require schema work (the `amends` / `superseded_by` FKs deferred from M4) that deserves its own milestone. They land in M5.5 after a dedicated amendment-lifecycle milestone.

Total new code budget: ~500 LOC across 12 files + one Vercel env var. No migrations. No new infra.

---

## Design decisions (Q1–Q5)

Recorded here so future reviewers understand which forks were considered:

### Q1 — Scope: M5-lean (5 tools, not 7)

**Decision:** Ship `record_decision`, `commit_decision`, `query_decisions`, `verify_chain`, `get_impact_radius`. Defer `amend_decision` + `supersede_decision` to M5.5.

**Rationale:** M5 exit criterion ("records and queries end-to-end") doesn't require amend/supersede. The amendment lifecycle is deferred-from-M4 schema work that deserves focused treatment, not bundling into the first agent-surface milestone. Tools must match reality — stub tools returning `NOT_IMPLEMENTED_YET` were rejected because stubs tend to linger.

**Forks rejected:**
- B — insert M4.5 amendment-lifecycle milestone before M5: pushes MCP out ~2 weeks for a feature the exit criterion doesn't need.
- C — stub amend/supersede tools with `NOT_IMPLEMENTED_YET` MCP errors: surface parity with PRD §5.6 at the cost of misleading the agent about what's actually supported.

### Q2 — Transport: HTTP streamable only

**Decision:** HTTP streamable transport on a Next.js route handler. No stdio. No SSE.

**Rationale:** Vercel already hosts the app. HTTP reaches both Claude Code (local + remote) and claude.ai remote MCP. stdio excludes the web client, which is at odds with the §10 success metric targeting broad agent adoption. Chain-commit logic already HTTP-round-trips Voyage for embeddings, so the theoretical localhost-latency advantage of stdio is noise.

**Forks rejected:**
- B — stdio only via a published npm package: excludes claude.ai; adds a separate binary to version and distribute.
- C — both: twice the testing surface with no clear user-segment benefit.

### Q3 — Library: `mcp-handler` (Vercel adapter)

**Decision:** `mcp-handler` — the published name of `@vercel/mcp-adapter`. Route at `src/app/api/mcp/[transport]/route.ts`, `basePath: "/api/mcp"`.

**Rationale:** First-party Vercel adapter; thin wrapper over `@modelcontextprotocol/sdk`; handles streamable HTTP + SSE transport plumbing; `withMcpAuth` handles 401/403 protocol-correctly. ~80 fewer lines of transport glue than rolling with the official SDK directly. Portability objection is weak — `server.tool(...)` shape matches the underlying SDK exactly; a future swap is a local refactor.

**Forks rejected:**
- B — `@modelcontextprotocol/sdk` + manual transport wiring: more control, more glue, no real-world benefit on Vercel.
- C — `mcp-handler` as a community package: same DX, less battle-tested; no reason to prefer it when Vercel ships the first-party version.

### Q4 — Auth: single env token

**Decision:** `RESOLVE_MCP_TOKEN` env var. Constant-time compare in `verifyToken`. Scopes `["record", "query"]` attached to the returned `AuthInfo` as forward-compat placeholder.

**Rationale:** PRD Q3 commits to OAuth in v1.1. Multi-token storage (tokens table) would be thrown away when OAuth lands. JWTs are also throwaway for the same reason. Single env token meets the M5 exit criterion (gates the endpoint) with ~10 lines. Upgrade path to the tokens table is clean: tool handlers already consume `extra.authInfo`, so replacing `verifyToken`'s backing store is a local change.

**Forks rejected:**
- B — JWT (HS256): more code, no real benefit at N=1 caller, still throwaway when OAuth lands.
- C — tokens table with per-token scopes + admin UI: real v1.1 feature; not M5 scope.

**Rotation:** Vercel env update + redeploy. Same blast radius as the Voyage rotation planned in HANDOFF §Outstanding. Dev-mode bypass explicitly rejected to prevent dev/prod drift.

### Q5 — `query_decisions`: hybrid (optional `query`)

**Decision:** `query` is optional. Present → semantic (reuses M3 `searchDecisions`). Absent → filter-only (new `listDecisionsFiltered` extending `listDecisionsByProjectSlug`).

**Rationale:** PRD R2 flags embedding cost drift as a real risk. An agent asking "all decisions tagged Postgres" should not pay a Voyage call. Both underlying query functions already exist or are trivial extensions. Single MCP tool surface keeps the agent contract small.

**Forks rejected:**
- A — semantic-only matching PRD §5.6 verbatim: wastes Voyage calls on filter-only queries.
- C — two separate tools (`query_decisions` + `list_decisions`): adds a tool to PRD §5.6; splits a concept that's naturally one operation.

**Output shape:** single array, each item carries nullable `similarity` (populated in semantic mode, `null` in filter mode). Discriminated union rejected as agent-unfriendly.

---

## Architecture & file layout

### URL shape
```
POST /api/mcp/http           ← streamable HTTP transport (primary)
POST /api/mcp/sse            ← SSE transport (available via adapter, not primary)
```

### Files

**New:**
```
src/app/api/mcp/[transport]/route.ts   Route handler. Registers all 5 tools, wraps with withMcpAuth.
src/mcp/tools/record-decision.ts       Thin wrapper → createDecision()
src/mcp/tools/commit-decision.ts       Thin wrapper → commitDecision() + after(() => backfillEmbedding())
src/mcp/tools/query-decisions.ts       Hybrid: query ? searchDecisions() : listDecisionsFiltered()
src/mcp/tools/verify-chain.ts          Iterates projects (or single), calls chain-verify library
src/mcp/tools/get-impact-radius.ts     Thin wrapper → getImpactRadius()
src/mcp/auth.ts                        verifyToken(req, bearerToken) — lazy env read, constant-time compare
src/mcp/schemas.ts                     zod input schemas — shared between tools + tests
src/mcp/wrap-tool.ts                   Tagged-error translator (UNKNOWN_PROJECT / NOT_FOUND / ALREADY_COMMITTED → MCP ToolError)
src/mcp/auth.test.ts                   Pure-function auth tests
src/mcp/tools/*.test.ts                One test file per tool (5 files)
src/app/api/mcp/[transport]/route.test.ts  Three route-level integration tests
```

**Modified:**
```
src/db/queries/decisions.ts            Add listDecisionsFiltered({projectSlug?, tags?, status?, from?, to?, limit?})
package.json                           + mcp-handler, + zod (if not already pulled in transitively)
```

### Dependencies

- `mcp-handler` — exact installed name verified at install time; versions ≥ 0.x.
- `zod` — for tool input schemas. Likely already present via drizzle-zod or similar; add explicitly if not.
- **No Redis.** Streamable HTTP transport doesn't require it; SSE would but SSE is not primary.
- **No new Vercel services.** Runs on the existing Functions deployment with `maxDuration: 60`.

### Env vars

| Var | Production | Preview | Development | Notes |
|---|---|---|---|---|
| `RESOLVE_MCP_TOKEN` | ✅ NEW | ✅ NEW | ✅ NEW | Bearer token; rotate via `vercel env rm`/`add` + redeploy |

### Load-bearing constraints preserved (from HANDOFF §Architecture)

1. **Lazy-init env reads.** `src/mcp/auth.ts` reads `process.env.RESOLVE_MCP_TOKEN` *inside* `verifyToken`, not at module top level. Turbopack evaluates modules at build time before runtime env is injected.
2. **Embed-on-commit outside the chain transaction.** MCP `commit_decision` fires `after(() => backfillEmbedding(id))` — never inside `commitDecision()`'s transaction. Preserves the per-project advisory-lock latency property.
3. **HNSW partial index untouched.** No schema changes in M5.
4. **`server-only` shim** already aliased in `vitest.config.ts` — applies to any new test files.
5. **drizzle array helpers** — if `listDecisionsFiltered` uses tag filtering, use `arrayContains` (AND semantics) as `searchDecisions` already does.

---

## Tool contracts

All tools share response format: `{ content: [{ type: "text", text: JSON.stringify(payload) }] }` per MCP protocol. JSON payloads documented below.

### 1. `record_decision`

**Input:**
```ts
{
  project: string,                     // slug
  title: string,                       // ≤120 chars
  rationale: string,
  tags: string[],                      // default []
  linear_issues: string[],             // default []
  author: string,                      // required
}
```
**Behavior:** `createDecision({projectSlug, title, rationale, tags, linearIssueIds, author})`. Status always `"proposed"` — no propose-and-commit shortcut.
**Payload:** `{ id: string, status: "proposed" }`
**Errors:** `UNKNOWN_PROJECT` for bad slug; zod `InvalidParams` for shape violations.

### 2. `commit_decision`

**Input:** `{ id: string }`
**Behavior:** `commitDecision(id)`. On success, `after(() => backfillEmbedding(id))`.
**Payload:** `{ id, chain_position: number, entry_hash: string /* hex */, committed_at: ISO string }`
**Errors:** `NOT_FOUND` for missing id; `ALREADY_COMMITTED` if already chained.

### 3. `query_decisions`

**Input:**
```ts
{
  query?: string,
  project?: string,
  tags?: string[],                     // AND semantics
  status?: "proposed" | "committed" | "amended" | "superseded",
  limit?: number,                      // min 1, max 100, default 20
  from?: string,                       // ISO date
  to?: string,                         // ISO date
}
```
**Behavior:** `query` present → Voyage embed + `searchDecisions`. Absent → `listDecisionsFiltered`.
**Payload:** `{ items: Array<{id, title, rationale, tags, author, committed_at, chain_position, project_slug, project_name, similarity: number | null}> }`
**Errors:** `InvalidParams` for bad enum / limit / date; `EMBEDDING_FAILED` (retryable) for Voyage errors.

### 4. `verify_chain`

**Input:** `{ project?: string, from?: number, to?: number }`
**Behavior:** If `project` present, verifies that one. If absent, iterates all projects via `listProjects()` and verifies each. One failing project does not short-circuit others.
**Payload:**
```ts
{
  results: Array<{
    project_slug: string,
    verified: boolean,
    chain_length: number,
    merkle_root: string,               // hex
    break_at: number | null,
    error: string | null,
  }>
}
```
**Errors:** `UNKNOWN_PROJECT` for bad slug.

### 5. `get_impact_radius`

**Input:** `{ decision_id: string, min_shared_tags?: number }` — defaults to `IMPACT_MIN_SHARED_TAGS` (2).
**Behavior:** `getImpactRadius(id, {minSharedTags})`.
**Payload:**
```ts
{
  decision_id: string,
  impact: Array<{id, title, project_slug, project_name, shared_tags: string[], shared_tag_count: number}>
}
```
**Errors:** `NOT_FOUND` for missing decision_id.

### Validation (all tools)

zod transforms applied before business logic:
- `tags` → trim + dedupe + drop empties
- `limit` → int, min 1, max 100, default 20
- `from`/`to` → ISO string → `Date` via transform
- Unknown fields → `.strict()` rejects with `InvalidParams`

---

## Data flow

### `record_decision` + `commit_decision` (two-call agent workflow)

`record` inserts with `status="proposed"`, returns the id. `commit` takes that id, opens a transaction, acquires per-project advisory lock, reads chain head, computes extension, updates the row. Response returns to the agent immediately; `after()` schedules `backfillEmbedding(id)` to run post-response — Voyage HTTP call happens outside the transaction and outside the response path (HANDOFF load-bearing constraint #2).

### `query_decisions` (hybrid)

Branches on `query` presence. Semantic path: Voyage embed → pgvector HNSW cosine → filter composition → rows with `similarity = 1 - cosine_distance`. Filter path: `listDecisionsFiltered` with composed `WHERE` clauses → rows with `similarity = null`.

### `verify_chain`

For each project (or just the requested one): `listChainByProjectSlug` returns committed rows ordered by `chain_position`. Walk the rows, recompute `content_hash` and `entry_hash`, compare to stored. Compute Merkle root from leaves. Collect `{verified, break_at, merkle_root, error}` per project.

### Auth (cross-cutting)

`withMcpAuth(handler, verifyToken, { required: true })`. `verifyToken` lazy-reads `RESOLVE_MCP_TOKEN`, constant-time compares with `timingSafeEqual`, returns `AuthInfo { token, scopes: ["record", "query"], clientId: "env-token" }` on match or `undefined` on mismatch (→ 401).

---

## Error handling

### Taxonomy

| Source | Mechanism | Client sees |
|---|---|---|
| Auth | `withMcpAuth` → 401/403 | HTTP status |
| Zod validation | `mcp-handler` auto | MCP `InvalidParams` |
| Business (tagged throw) | `wrapTool` translator | MCP `ToolError` with `code` |
| DB / infra | Uncaught → adapter | MCP `InternalError`, full trace server-logged |
| Voyage timeout / 5xx | Caught + translated | MCP `ToolError` `code: "EMBEDDING_FAILED"`, `retryable: true` |

### Business error codes

- `UNKNOWN_PROJECT` — bad slug on `record_decision`, `verify_chain`.
- `NOT_FOUND` — bad id on `commit_decision`, `get_impact_radius`.
- `ALREADY_COMMITTED` — re-commit of a committed decision.
- `EMBEDDING_FAILED` — Voyage call failed during semantic query; retryable.

### Idempotency

- `record_decision` — no idempotency key in v1 (acceptable per UI parity). Add if duplicate-rate becomes real.
- `commit_decision` — already idempotent: double-commit returns `ALREADY_COMMITTED`, safe to retry.

### Rate limiting

Out of scope for M5. Single-token v1, one agent caller. Voyage itself rate-limits; surfaces as `EMBEDDING_FAILED` retryable.

### Observability

Per tool call: one log line `{ts, tool, client_id, duration_ms, ok, error_code?}`. No PII (no title, no rationale). `verboseLogs: true` in dev only via env gate.

### Dev auth

No bypass. `.env.local` gets a dev token; `pnpm dev` requires it. Prevents dev/prod auth drift.

---

## Testing strategy

### Pyramid

1. **Manual smoke** via Claude Code — pre-ship only, documents the M5 exit criterion.
2. **Route-level integration** (3 tests) — HTTP POST through the real adapter + auth.
3. **Tool wrappers** (~15 tests, DB-backed) — one test file per tool.
4. **Auth** (~5 tests, pure function).

### Layer 3 coverage

| Tool | Tests |
|---|---|
| `record-decision` | happy; unknown project; tags dedupe + trim; title >120 rejected; author required |
| `commit-decision` | happy; unknown id; double-commit; `after()` fires embedding (spy on Voyage client, allowed mock) |
| `query-decisions` | filter mode (similarity null); semantic mode (similarity 0–1); tag narrow; status filter; limit cap; bad enum |
| `verify-chain` | both projects happy; tamper detection; unknown project; no-project iterates all |
| `get-impact-radius` | happy (reuses impact.test.ts fixtures); unknown id; `min_shared_tags` override |

### Layer 2 coverage

- `POST /api/mcp/http` + `tools/list` + valid token → 200, all 5 tools listed
- `POST /api/mcp/http` + no auth → 401
- `POST /api/mcp/http` + `tools/call record_decision` → DB round-trip + `{id}`

### Manual smoke (acceptance)

```bash
claude mcp add --transport http resolve-local http://localhost:3000/api/mcp \
  --header "Authorization: Bearer $RESOLVE_MCP_TOKEN"
```

Then in Claude Code: list tools, record, commit, query, verify, impact. All six pass = M5 exit criterion met.

### Test infra

- `server-only` shim via existing `vitest.config.ts` alias.
- DB fixtures per `impact.test.ts` pattern: `beforeEach` seed, `afterEach` truncate.
- Voyage real in semantic tests (matches M3); mocked only to assert `after()` scheduling.
- `after()` assertion: "called within 500ms of commit response" — best available given timing-precise assertions are flaky.

---

## Out of scope (M5.5 and beyond)

- **`amend_decision`** + **`supersede_decision`** — require `amends` + `superseded_by` schema work (deferred from M4). M5.5 after a dedicated amendment-lifecycle milestone.
- **OAuth** — PRD Q3 v1.1. Env-token upgrade path preserved in `AuthInfo` shape.
- **Rate limiting** — v1.1 alongside OAuth.
- **Tokens table** — v1.1 alongside OAuth.
- **Idempotency keys** on `record_decision` — add if duplicate-rate becomes real.
- **Auto-embedding tag tokens** — flagged in HANDOFF as M3.5 tuning; orthogonal to M5.
- **`linear_issues` resolution** — M6 scope. M5 just stores the strings.

---

## Open risks / assumptions

- **`after()` from `/api/[transport]/route.ts`** — documented to work, but this is the first M5 test case. If it doesn't, fall back to synchronous embed inside the tool (costs ~200–500ms of response latency).
- **`mcp-handler` package name** — docs use both `@vercel/mcp-adapter` (repo) and `mcp-handler` (import). Confirm exact published name at `pnpm add` time.
- **`zod` transitive availability** — confirm during install; add explicitly if not already resolved.
- **Manual smoke CI-isation** — deferred. Acceptable because the smoke is the exit criterion, not a regression gate.

---

## References

- PRD `docs/PRD.md` §5.6, §8, §9, §10
- HANDOFF `docs/HANDOFF.md` (load-bearing constraints, outstanding items)
- M3 plan `docs/plans/2026-04-19-m3-search.md` (semantic search layer)
- M4 plan `docs/plans/2026-04-19-m4-cross-project.md` (impact radius layer)
- `mcp-handler` docs — Vercel adapter, `withMcpAuth`, Streamable HTTP transport
