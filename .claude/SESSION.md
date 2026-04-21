# Session State: resolve

**Last updated:** 2026-04-21T19:35:00Z
**Machine:** Sherlock
**Branch:** `main` (clean, synced with `origin/main` after M5 squash-merge)
**Last commit on main:** `74a9aff` — docs: track .claude/SESSION.md to hand off work across machines (plus this update)

## Where we left off

**M5 (MCP server) is shipped to production.** PR #4 squash-merged 2026-04-20 as commit `27b2038`. Vercel auto-deployed twice on the new main: `dpl_DPnxV86r6BXreRhN3ucWeKnNvmrp` (M5 squash) and `dpl_3FzrHFKDrd16k59tGUBNz8LqWhBD` (SESSION.md cherry-pick) — both production, both READY.

**Production smoke partially confirmed.** The route is verifiably live + authenticating: `web_fetch_vercel_url` against `https://resolve-buh9bopwr-gary-davidsons-projects.vercel.app/api/mcp/mcp` returned 401 with `x-matched-path: /api/mcp/[transport]` and a proper `www-authenticate: Bearer ...` MCP/OAuth2 challenge. **Full bearer-auth curl smoke is blocked** by Vercel deployment protection clobbering our `Authorization` header — see HANDOFF outstanding item #7 for the fix.

The 5-tool functional smoke ran end-to-end against `feat/m5-mcp` preview + `localhost` and passed (transcript in `docs/m5-mcp-usage.md`). The same code is now on production.

## Next action

When resuming, run `/whereami` first.

Then **M5.5 (next milestone)** — see HANDOFF outstanding item #7 (Roadmap section). Quick framing:
- Schema migration adding `amends` (uuid, nullable, FK → decisions.id) and `superseded_by` (uuid, nullable, FK → decisions.id) columns on `decisions`.
- Two new MCP tools: `amend_decision(id, rationale_delta, reason)` and `supersede_decision(old_id, new_id, reason)`.
- UI affordances on Decision Detail to show amendment/supersession trails.
- Probably starts with a brainstorming pass to lock the lifecycle semantics (does an amendment create a new chain entry? what's the canonical-content rule? does supersede mark old as inactive in queries by default?).

## Pre-M5.5 cleanup tasks (worth a 1-hour chore PR)

These are short, independent, and unblock cleaner M5.5 + M6 work:
1. **Vercel deployment protection rule for `/api/mcp/*`** (HANDOFF #7) — one dashboard click. Without this, no external agent can hit the production MCP server.
2. **`VOYAGE_API_KEY` to Vercel preview env** (HANDOFF #4) — one CLI command. Pre-existing M3-era gap; first preview that runs a semantic query will 500 without it.
3. **Vercel CLI upgrade to 51.8+** (HANDOFF #6) — one npm install. Lets us re-add `RESOLVE_MCP_TOKEN` to preview as all-branches instead of feat-branch-scoped.
4. **Token rotations** (HANDOFF #1–3) — Voyage key, Vercel API token, MCP token. User said a comprehensive keys-management solution is in flight; fold all three rotations into it when it lands.

## Open questions

- **Production smoke**: do we want CI to run a curl smoke after each main deploy, or is the build-success + the next time-someone-actually-uses-MCP enough? CI smoke needs the deployment-protection exception (item 1 above) AND a non-sensitive test token in CI secrets.
- **M5.5 brainstorm scope**: same lean-cut as M5 (5 tools, shipped a milestone), or wider (lifecycle semantics + UI + tools all in one milestone)?

## Don't forget

### Worktree state

- No active worktrees. `feat/m5-mcp` deleted both locally and on origin (auto-deleted by `gh pr merge --delete-branch`, despite the local checkout warning).
- `.worktrees/` is gitignored on main (lands via the M5 squash) — future feature work can use the same `git worktree add .worktrees/...` pattern.

### Active environment state

- `RESOLVE_MCP_TOKEN` lives in:
  - `.env.local` (gitignored, 64-char hex)
  - Vercel Production (sensitive)
  - Vercel Preview (sensitive, **scoped to `feat/m5-mcp` branch only** — branch is now deleted on origin, so the env entry is effectively dead weight; clean up post-CLI-upgrade)
  - Vercel Development (non-sensitive — Vercel API rejects `--sensitive` on development)
  - Token value is the same across all four locations.
- Local `~/.claude.json` has `resolve-local` MCP server registered (via `claude mcp add` during Task 15). It points at `http://localhost:3000/api/mcp/mcp` — only works when `pnpm dev` is running.

### Load-bearing constraints (from M5)

- MCP streamable-HTTP path is `/api/mcp/mcp`, NOT `/api/mcp/http`. The `[transport]` dynamic segment captures `mcp` because that's what `mcp-handler` builds its endpoint at. All client configs and smoke tests must use this.
- `wrapTool` splits errors into `ToolError` (business — returns `isError: true` with stable `code`) vs thrown exceptions (infra — propagate as MCP `InternalError`). Don't conflate.
- `auth.ts` fail-closes when `RESOLVE_MCP_TOKEN` is unset (throws, doesn't silent-401). Surfaces misconfiguration loudly. Don't change.
- Preview deploys behind Vercel deployment protection are reachable via `vercel curl` for routes that don't already use `Authorization` for app-level auth. Our MCP route uses `Authorization` for bearer, so `vercel curl` clobbers it. Use `web_fetch_vercel_url` (Vercel MCP tool) for read-only checks, or set up a protection-bypass secret for write smokes.

### Transcript leaks (still pending rotation)

- Voyage key `pa-tTHOZ…`
- Vercel API token `vck_6V…`
- `RESOLVE_MCP_TOKEN` (current value) — leaked twice during M5 execution. Folded into the keys-management rotation.

### Canonical project state

- `docs/HANDOFF.md` is authoritative. SESSION.md is per-session working memory. If they conflict, HANDOFF wins.
- PRD milestone status: M0–M5 complete; M5.5 (amendment lifecycle + 2 deferred MCP tools) is next; then M6 (Linear), M7 (Deploy hardening).
- Test count: 68 (was 32 before M5).
- Production live URLs: `https://resolve-two-iota.vercel.app` (alias) + raw deploy at `resolve-buh9bopwr-gary-davidsons-projects.vercel.app`. Both behind Vercel SSO until item #7 is addressed.
