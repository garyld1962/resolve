# M5 MCP server — usage

Resolve's MCP server exposes five tools that let an agent (Claude Code, custom clients) record, commit, query, and verify decisions over HTTP with bearer-token auth.

This doc doubles as the **M5 exit-criterion evidence** (PRD §8: *"Claude Code records and queries end-to-end"*) — the transcript below was produced against a fresh local dev server on 2026-04-20.

## Setup

1. **Token** — a 32-byte random hex string lives in `.env.local` as `RESOLVE_MCP_TOKEN`. Generate with:

   ```bash
   openssl rand -hex 32
   ```

   Provision on Vercel for the environments you'll hit:

   ```bash
   vercel env add RESOLVE_MCP_TOKEN production --sensitive
   vercel env add RESOLVE_MCP_TOKEN preview <gitbranch> --sensitive --value "$(cat token.tmp)" --yes
   vercel env add RESOLVE_MCP_TOKEN development
   ```

   `--sensitive` is rejected on the `development` target (Vercel API constraint). The preview flag form shown is a workaround for CLI 51.5.0 — the all-preview-branches form `vercel env add RESOLVE_MCP_TOKEN preview --value ... --yes --sensitive` ignores `--yes` in that version and still prompts for a branch. Upgrade to CLI 51.8+ to use all-preview-branches.

2. **Register with Claude Code** (after `pnpm dev` is running):

   ```bash
   set -a && . .env.local && set +a
   claude mcp add --transport http resolve-local http://localhost:3000/api/mcp/mcp \
     --header "Authorization: Bearer $RESOLVE_MCP_TOKEN"
   claude mcp list   # expect: resolve-local (HTTP) - ✓ Connected
   ```

   > **Heads up**: `claude mcp add` currently echoes the `Authorization` header value to stdout. Don't run it where the output lands in a shared log or pasteable transcript.

## Endpoint

- **Path**: `/api/mcp/mcp` — the `mcp-handler` adapter derives its streamable-HTTP endpoint as `${basePath}/mcp`. With `basePath="/api/mcp"` (the route file's config), only pathname `/api/mcp/mcp` matches.
- **Auth**: `Authorization: Bearer <RESOLVE_MCP_TOKEN>`. Missing or wrong token → 401.
- **Content**: JSON-RPC 2.0 over HTTP; responses may be plain JSON or SSE-framed depending on the `Accept` header.

Curl smoke (local):

```bash
curl -s -X POST http://localhost:3000/api/mcp/mcp \
  -H "Authorization: Bearer $RESOLVE_MCP_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Curl smoke (Vercel preview — protection-bypass-required):

```bash
vercel curl /api/mcp/mcp --deployment <preview-hostname> -- \
  -X POST \
  -H "Authorization: Bearer $RESOLVE_MCP_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`vercel curl` signs the request so Vercel's deployment protection lets it through; normal `curl` gets a 401 with an HTML auth page.

## Tools

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `record_decision` | Create a new decision with `status=proposed` | `project`, `title`, `rationale`, `tags?`, `linear_issues?`, `author` | `{ id, status: "proposed" }` |
| `commit_decision` | Commit a proposed decision — extends the SHA-256 chain + schedules async embedding backfill | `id` | `{ chain_position, entry_hash, merkle_root }` |
| `query_decisions` | Query with optional semantic similarity; omit `query` for pure filter mode | `query?`, `project?`, `tags?`, `status?`, `limit?`, `from?`, `to?` | `[{ id, title, similarity?, ... }, ...]` |
| `verify_chain` | Walk the chain, report integrity status | `project?` (omit to iterate all) | `{ verified, chain_length, merkle_root, break_at? }` |
| `get_impact_radius` | Tag-overlap neighbors across projects (≥2 shared tags) | `id` | `{ neighbors: [{ project, id, title, shared_tags }, ...] }` |

`record_decision` and `commit_decision` are deliberately split so an agent can stage a decision for human review before extending the chain.

## Exit-criterion transcript (2026-04-20, `feat/m5-mcp`)

Fresh Claude Code session, `resolve-local` registered per Setup above. All six exchanges succeeded on first call.

**1. Tool discovery**

```
> What MCP tools are available under resolve-local?

The resolve-local MCP server exposes these tools:
  - mcp__resolve-local__commit_decision
  - mcp__resolve-local__get_impact_radius
  - mcp__resolve-local__query_decisions
  - mcp__resolve-local__record_decision
  - mcp__resolve-local__verify_chain
```

**2. `record_decision`**

```
> Using resolve-local, record a decision in project "resolve" with title
  "M5 ships — MCP server live", rationale "First agent-callable surface
  for Resolve. Tools: record, commit, query, verify, impact.", tags MCP,
  agent, milestone, author "gary".

Called resolve-local → record_decision
Recorded — decision bd400039-4b4a-42d0-93ac-0e984eddbd4a is in proposed
status. Call commit_decision to chain it when ready.
```

**3. `commit_decision`**

```
> Now commit that decision.

Called resolve-local → commit_decision
Committed at chain position 2, hash 01379716...e06080.
```

Note: the decision landed at chain position 2 because the project already had one committed decision at position 1 (the M2 advisory-lock decision).

**4. `query_decisions` (semantic)**

```
> Using resolve-local, query for decisions about "agent callable surface".

Called resolve-local → query_decisions
Top match: M5 ships — MCP server live (similarity 0.56, chain pos 2).
Two weaker matches:
  - Adopt Supabase over Neon for v1 (0.36)
  - Use advisory xact locks to serialize per-project commits (0.34, chain pos 1)
```

The M5 decision was the top hit on first query, which implies its embedding completed between the `commit_decision` and `query_decisions` calls — the async `after()` backfill pattern (load-bearing constraint #3) worked end-to-end.

**5. `verify_chain`**

```
> Verify the chain for project "resolve".

Called resolve-local → verify_chain
Chain verified: 2 entries, intact, no breaks. Merkle root 1e517fd8...4311e9.
```

**6. `get_impact_radius`**

```
> Get the impact radius of the decision we just committed.

Called resolve-local → get_impact_radius
Empty radius — no other projects have decisions sharing ≥2 tags with
[MCP, agent, milestone].
```

Empty is expected — the M4 seed's `baker-street` project is tagged on Postgres / Supabase / Auth / pgvector topics, which don't overlap with the three MCP-specific tags on this decision.

## Error semantics

| Condition | HTTP | MCP response |
|-----------|------|--------------|
| Missing / wrong bearer token | 401 | (HTML from auth layer) |
| Valid token, unknown `project` slug | 200 | `isError: true`, `{ code: "UNKNOWN_PROJECT" }` |
| Valid token, unknown `id` | 200 | `isError: true`, `{ code: "NOT_FOUND" }` |
| Valid token, malformed input | 200 | `isError: true`, `{ code: "InvalidParams" }` |
| Infra error (DB down, etc.) | 200 | MCP `InternalError` (thrown) |

Business errors return `isError: true` with a stable `code` so an agent can branch on it. Infra errors propagate as MCP `InternalError` and the agent should retry or surface the failure.

## Gotchas

- **Path is `/api/mcp/mcp`, not `/api/mcp/http`**. The `[transport]` dynamic segment captures `mcp` because that's the literal segment `mcp-handler` builds its endpoint at.
- **Preview deploys are behind Vercel deployment protection**. Use `vercel curl --deployment <hostname>` for smoke tests, or set a protection-bypass secret for external clients.
- **`RESOLVE_MCP_TOKEN` must be set for the route to answer anything** — `auth.ts` fail-closes with a thrown Error when the env var is absent, surfacing the misconfiguration instead of silent 401s.
- **Embeddings are async**. A newly-committed decision may return with `similarity: null` from `query_decisions` if the query fires before Voyage answers. Re-query a second later and the similarity is populated.
