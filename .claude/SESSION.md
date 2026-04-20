# Session State: resolve

**Last updated:** 2026-04-20T09:23:33Z
**Machine:** Sherlock
**Branch:** `feat/m5-mcp` (in worktree `.worktrees/feat-m5-mcp`); local `main` has 2 unpushed commits (plan + gitignore)
**Last commit on feat branch:** `85b2642` — M5: tool get_impact_radius — wraps getImpactRadius()

## Where we left off

**M5 implementation is in flight via Subagent-Driven Development in a git worktree.** 3 of 5 batches complete (Tasks 2–11 of 16): deps install, `listDecisionsFiltered` helper, `auth.ts`, shared zod schemas, `wrap-tool`, **all 5 MCP tools** (`record_decision`, `commit_decision`, `query_decisions`, `verify_chain`, `get_impact_radius`). 65/65 tests passing, typecheck clean.

**Just before /session-save:** finished Batch 3 (all 5 tools). Reported status to user and asked `go | pause | push` for Batch 4 (route handler + integration tests). User chose `/session-save` → pausing mid-batch-boundary.

## Next action

**When resuming, run `/whereami` first** — it'll show current git state.

Then to continue M5:
1. Confirm you want to proceed with **Batch 4: Tasks 12–13** (MCP route handler at `src/app/api/mcp/[transport]/route.ts` + route-level integration tests). Read those task sections in `docs/plans/2026-04-19-m5-mcp.md` (lines ~1952 and ~2065 of the plan file) for the full step-by-step.
2. Then Batch 5: Tasks 14 (Vercel env setup — `vercel env add RESOLVE_MCP_TOKEN` to all 3 envs), 15 (Claude Code manual smoke — M5 exit criterion), 16 (HANDOFF update + PR).

**To resume the worktree:**
```bash
cd /home/gary/repos/resolve/.worktrees/feat-m5-mcp
git status   # should be clean
pnpm test    # should show 65/65 pass
pnpm typecheck  # should be clean
```

## Open questions

- **Push cadence:** nothing on this branch has been pushed yet. Local `main` is also 2 commits ahead of `origin/main` (the M5 plan doc `165b593` + worktree gitignore `40e4d7e`). Whole stack stays local until the user says `push` — matches the HANDOFF convention where each milestone lands as a single squashed commit at PR merge time.
- **Flaky test** noted during Task 9: `src/db/queries/search.test.ts` cosine-ordering test failed once, passed on retry. Pre-existing from M3. Not a blocker; worth flagging in the M5 PR body.
- **Zod 4 vs mcp-handler Zod 3** — batch 1 quality reviewer flagged this. No issues surfaced in Tasks 7–11 (all tool validation works). Keep an eye on Task 12's `server.tool(name, description, schema, handler)` call — the schema-arg shape may need `.shape` extraction depending on mcp-handler's expectation.
- **Reviewer ceremony:** I ran full spec+quality reviewer dispatch for Tasks 3, 4, 7, 8 and skipped it for Tasks 5, 6, 9, 10, 11 based on task complexity + implementer self-review cleanliness. Of the 4 full reviews, 2 substantive issues were caught, but *by me running typecheck / reading code*, not by the reviewers. Net: reviewer dispatches mostly didn't pay their cost. If resuming, judge per task — don't dispatch reviewers mechanically.

## Don't forget

### M5 plan-vs-reality drift (important for Batch 4 + 5)

Five corrections already applied during Batches 2–3 that future batches should know about:

1. **`embedDecisionAfterCommit` (not `backfillDecisionEmbedding`)** — extracted from `src/app/decisions/[id]/actions.ts` into `@/db/queries/embeddings` as a shared helper (commit `68b1a00`). Both UI action and MCP `commit_decision` import it.
2. **`LIST_DEFAULT_LIMIT` → `DEFAULT_LIMIT`** — renamed in `decisions.ts` to match `search.ts` convention (`1699c7c`).
3. **`StatusSchema` narrowed** to `["proposed", "committed"]` (the DB enum's actual values; amend/supersede come in M5.5). Commit `dbf6483` also narrowed `ListDecisionsFilters.status` to match.
4. **`@modelcontextprotocol/sdk` now a direct dep** — pnpm strict mode blocked transitive imports. Pinned explicitly in `dbf6483`.
5. **Voyage `embed()` real signature**: `(texts: string[], inputType: "document"|"query") => Promise<number[][]>`. Plan had it as `(text: string) => number[]` — wrong. Import from `@/lib/voyage` barrel (not `client.ts` directly).
6. **vi.mock hoisting** requires `vi.hoisted()` for spy factories — see `src/mcp/tools/commit-decision.test.ts` and `src/mcp/tools/query-decisions.test.ts` for the canonical pattern.
7. **Zod `.uuid()` in v4** is strict about v4 UUID format (version digit must be `4`, variant `8`/`9`/`a`/`b`). Use `"00000000-0000-4000-8000-000000000000"` for unknown-id test fixtures; plain zero-padded UUIDs fail validation.
8. **Zod errors stay as InvalidParams**, not `NOT_FOUND` — design spec §Error Handling. Commit `b1bfb2a` reverted one such conflation.

### Worktree + branch state

- Worktree: `/home/gary/repos/resolve/.worktrees/feat-m5-mcp`
- `.env.local` is symlinked from the main repo — Postgres + Voyage keys resolve without extra setup.
- `.worktrees/` is gitignored via commit `40e4d7e` on local main.
- **Local `main` is 2 commits ahead of `origin/main`** — `165b593` (M5 plan) + `40e4d7e` (gitignore). Not pushed yet. When the feature PR goes up, this stack will need to land on origin first (or travel with the feature PR at merge time).

### Security (unchanged from earlier session)

- 🔴 Voyage key `pa-tTHOZ…` and Vercel token `vck_6V…` still leaked in transcripts. Rotation still pending.
- 🔴 Preview env still missing `VOYAGE_API_KEY`.
- Batch 5 adds another secret: `RESOLVE_MCP_TOKEN` — generate via `openssl rand -hex 32`, add to Vercel Production/Preview/Development via `vercel env add`. Do NOT let the token value land in conversation transcripts.

### Tests + commits on `feat/m5-mcp` (16 commits, all since `40e4d7e` on main)

```
85b2642 M5: tool get_impact_radius — wraps getImpactRadius()
8336bc1 M5: tool verify_chain — single project or iterate all
c2ff9dd M5: tool query_decisions — hybrid semantic/filter
b1bfb2a M5: fix commit_decision error semantics — separate zod from NOT_FOUND
819ac33 M5: tool commit_decision — wraps commitDecision() + after() embed
68b1a00 M5 (refactor): extract embedDecisionAfterCommit into embeddings.ts
2da19cf M5: tool record_decision — wraps createDecision()
8e699c6 M5: wrapTool + ToolError for MCP handler responses
dbf6483 M5: fix typecheck drift — add sdk direct dep + narrow status enum
04a679f M5: shared zod schemas for MCP tool inputs
c80fb78 M5: add server-only marker to auth.ts for convention parity
51acca1 M5: MCP bearer-token verifier (env-sourced, timing-safe)
1699c7c M5: rename LIST_DEFAULT_LIMIT → DEFAULT_LIMIT for intra-file consistency
41a0b62 M5: add listDecisionsFiltered query for MCP filter-only path
743c837 M5: add mcp-handler + zod
40e4d7e chore: gitignore .worktrees/ for feature-isolated checkouts  ← also on local main
```

Test count: 65 (up from 32 baseline). Typecheck: clean.

### Canonical project state (unchanged)

- `docs/HANDOFF.md` is the durable project state reference. SESSION.md is per-session working memory. If they conflict, HANDOFF wins.
- PRD milestone status: M0–M4 complete; M5 (this work) in flight; M5.5 (amendment lifecycle — schema migration for `amends`/`superseded_by` + the two deferred MCP tools) comes next; then M6 (Linear), M7 (Deploy).
- Five load-bearing design constraints from HANDOFF still apply — especially lazy-init env reads and the embed-on-commit-outside-transaction pattern. `auth.ts` and `commit_decision` tool both respect these.
