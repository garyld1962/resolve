# M4 — Cross-Project Impact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface cross-project influence — every Decision Detail page shows committed decisions in other projects that share ≥2 tags, and a new `/cross-impact` view lists all such pairs across the dataset.

**Architecture:** Two read-only queries layered on the existing schema (zero migrations). Per-decision `getImpactRadius(id)` returns ranked impact items; global `getCrossProjectImpactPairs()` returns the cross-project pair list for the Cross-Impact page. Tag intersection happens in JS — Postgres array overlap (`&&`) narrows the candidate set, application code computes the actual shared count. Two views render columnarly (no force-directed graph in v1). Seed gains a second project (`baker-street`) + 3 sample committed decisions designed to overlap with the existing Resolve decisions on `Postgres`, `Supabase`, `Auth`, `pgvector`, `concurrency`, and `advisory-lock`.

**Tech Stack:** Drizzle ORM 0.45 (`arrayOverlaps`), Next.js 16 App Router server components, vitest. No new dependencies.

**Source:** PRD `docs/PRD.md` §5.4 + §8 (M4 exit criteria). Lean scope locked this session — supersession/amendment lifecycle from §5.1 deferred to a later milestone, real graph layout deferred to v1.1. Three confirmed simplifications: columnar list (not force-directed graph), `IMPACT_MIN_SHARED_TAGS = 2` as a hardcoded constant, and seed auto-runs `db:backfill-embeddings` via subprocess.

---

## File Map

**New:**
- `src/db/queries/projects.ts` — `listProjects()` (used by Cross-Impact page header)
- `src/db/queries/impact.ts` — `getImpactRadius`, `getCrossProjectImpactPairs`, `IMPACT_MIN_SHARED_TAGS`, plus `ImpactItem` / `ImpactPair` / `ImpactEndpoint` types
- `src/db/queries/impact.test.ts` — DB-backed fixture tests (3 projects, 5 decisions)
- `src/components/impact-panel.tsx` — server component panel (renders `ImpactItem[]`)
- `src/app/cross-impact/page.tsx` — `/cross-impact` view server component

**Modified:**
- `src/db/seed.ts` — extends to seed `baker-street` + 3 sample committed decisions; chains `db:backfill-embeddings` via subprocess
- `src/app/decisions/[id]/page.tsx` — inserts `<ImpactPanel decisionId={id} />` after the chain-entry section
- `src/app/page.tsx` — adds `Cross-Impact` nav button, bumps footer milestone label

---

## Task 1 — Branch setup

- [ ] **Step 1: Create + checkout branch from main**

```bash
git -C /home/gary/repos/resolve status --short
git -C /home/gary/repos/resolve checkout -b feat/m4-cross-project
git -C /home/gary/repos/resolve branch --show-current
```
Expected: working tree clean, output ends with `feat/m4-cross-project`.

---

## Task 2 — Extend seed: baker-street project + 3 sample decisions + auto-backfill

**Files:**
- Modify: `src/db/seed.ts` (full rewrite — current file is ~40 lines)

- [ ] **Step 1: Replace `src/db/seed.ts`**

Overwrite with:
```typescript
import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { spawn } from "node:child_process";
import { and, eq } from "drizzle-orm";
import { decisions, projects, type NewDecision } from "./schema";

config({ path: ".env.local" });

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  throw new Error("POSTGRES_URL_NON_POOLING is not set");
}

const sql = postgres(url, { prepare: false });
const db = drizzle(sql);

type ProjectSpec = { slug: string; name: string; accentColor: string };
type DecisionSpec = {
  projectSlug: string;
  title: string;
  rationale: string;
  tags: string[];
  author: string;
};

const PROJECTS: ProjectSpec[] = [
  { slug: "resolve", name: "Resolve", accentColor: "#10B981" },
  { slug: "baker-street", name: "Baker Street", accentColor: "#6366F1" },
];

/* Tags chosen to overlap with the existing Resolve seed decisions:
   - "Adopt Supabase…" → Supabase, Postgres, pgvector, Auth, RLS
   - "Use advisory xact locks…" → Postgres, concurrency, chain, advisory-lock
   Each baker-street decision shares ≥2 tags with at least one Resolve decision,
   so the M4 impact panel and Cross-Impact view have something to render. */
const SAMPLE_DECISIONS: DecisionSpec[] = [
  {
    projectSlug: "baker-street",
    title: "Switch from Auth0 to Supabase Auth",
    rationale:
      "Consolidate on a single auth provider across both projects. RLS policies become easier to reason about when auth and data live in the same Supabase project. Migration risk acknowledged but deemed acceptable for v1.",
    tags: ["Supabase", "Auth", "RLS", "migration"],
    author: "baker-street-bot",
  },
  {
    projectSlug: "baker-street",
    title: "Use Postgres advisory locks for queue dedup",
    rationale:
      "Same advisory-lock pattern Resolve uses for per-project chain commits. Avoids adding Redis just for queue coordination — Postgres is already in the stack and the lock semantics are well-understood.",
    tags: ["Postgres", "concurrency", "advisory-lock", "queue"],
    author: "baker-street-bot",
  },
  {
    projectSlug: "baker-street",
    title: "Adopt pgvector for prompt cache similarity",
    rationale:
      "Reuses the pgvector extension we enabled for Resolve M3. Single embeddings infrastructure across both projects; no separate vector DB to operate. Voyage embeddings already proven in Resolve.",
    tags: ["Postgres", "pgvector", "cache", "LLM"],
    author: "baker-street-bot",
  },
];

async function ensureProject(spec: ProjectSpec): Promise<void> {
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, spec.slug))
    .limit(1);
  if (existing.length > 0) {
    console.log(`✓ project '${spec.slug}' already exists`);
    return;
  }
  await db.insert(projects).values({
    slug: spec.slug,
    name: spec.name,
    accentColor: spec.accentColor,
  });
  console.log(`✓ seeded project '${spec.slug}'`);
}

async function ensureSampleDecision(
  spec: DecisionSpec,
  chainPosition: number,
): Promise<void> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, spec.projectSlug))
    .limit(1);
  if (!project) throw new Error(`project ${spec.projectSlug} not found`);

  const existing = await db
    .select({ id: decisions.id })
    .from(decisions)
    .where(
      and(eq(decisions.projectId, project.id), eq(decisions.title, spec.title)),
    )
    .limit(1);
  if (existing.length > 0) {
    console.log(`✓ decision '${spec.title}' already exists`);
    return;
  }

  // Dummy chain fields. These seeded decisions don't participate in the real
  // M2 SHA-256 chain — that's reserved for decisions recorded via the UI.
  // For M4 (which only filters by status='committed' and reads tags), dummy
  // hashes are sufficient. The /chain page for baker-street will show
  // placeholder hashes — acceptable trade-off for not having to inline the
  // chain extension logic in this script.
  const dummyHash = Buffer.alloc(32, 0xee);
  const values: NewDecision = {
    projectId: project.id,
    title: spec.title,
    rationale: spec.rationale,
    tags: spec.tags,
    author: spec.author,
    status: "committed",
    chainPosition,
    contentHash: dummyHash,
    prevHash: Buffer.alloc(32, 0),
    entryHash: dummyHash,
    committedAt: new Date(),
  };
  await db.insert(decisions).values(values);
  console.log(`✓ seeded decision '${spec.title}' in '${spec.projectSlug}'`);
}

async function main() {
  for (const project of PROJECTS) await ensureProject(project);

  // chain_position is per-project (enforced by the unique index). Track
  // and increment per project as we iterate.
  const positionByProject: Record<string, number> = {};
  for (const decision of SAMPLE_DECISIONS) {
    positionByProject[decision.projectSlug] =
      (positionByProject[decision.projectSlug] ?? 0) + 1;
    await ensureSampleDecision(
      decision,
      positionByProject[decision.projectSlug],
    );
  }
}

function spawnBackfill(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("\n→ running embedding backfill for newly-seeded decisions");
    const child = spawn("pnpm", ["db:backfill-embeddings"], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`backfill exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

main()
  .then(async () => {
    try {
      await spawnBackfill();
    } catch (e) {
      console.warn(
        `⚠ backfill skipped (seed succeeded; embed manually with pnpm db:backfill-embeddings): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Run the seed**

```bash
pnpm db:seed
```
Expected output:
```
✓ project 'resolve' already exists
✓ seeded project 'baker-street'
✓ seeded decision 'Switch from Auth0 to Supabase Auth' in 'baker-street'
✓ seeded decision 'Use Postgres advisory locks for queue dedup' in 'baker-street'
✓ seeded decision 'Adopt pgvector for prompt cache similarity' in 'baker-street'

→ running embedding backfill for newly-seeded decisions
✓ embedded 3 (running total: 3)
done — 3 embeddings backfilled
```

If backfill warns instead of running cleanly, that means `VOYAGE_API_KEY` is not set in `.env.local`. Set it via `vercel env pull .env.local` and re-run `pnpm db:backfill-embeddings`. Seed itself still succeeded.

- [ ] **Step 4: Verify in DB**

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { prepare: false });
(async () => {
  const r = await sql\`SELECT p.slug, COUNT(d.*) AS decisions, COUNT(d.embedding) AS embedded FROM projects p LEFT JOIN decisions d ON d.project_id = p.id GROUP BY p.slug ORDER BY p.slug\`;
  console.log(r);
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
"
```
Expected: two rows. `baker-street` has `decisions=3, embedded=3`. `resolve` has its previous count (≥2 if you've recorded any).

- [ ] **Step 5: Commit**

```bash
git -C /home/gary/repos/resolve add src/db/seed.ts
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: extend seed with baker-street project + 3 sample decisions

Adds a second project so the M4 cross-project impact view has more
than one column to render. The three sample decisions are tagged to
overlap deliberately with Resolve's existing committed decisions on
Postgres, Supabase, Auth, pgvector, concurrency, and advisory-lock —
each pair shares ≥2 tags so the impact panel and Cross-Impact view
have non-trivial content from the moment M4 ships.

Seeded decisions use dummy chain fields (status='committed' but not
part of the real M2 SHA-256 chain). M4 only reads status + tags +
embedding, so this is sufficient. The /chain view for baker-street
will show placeholder hashes — acceptable for seed data.

After seeding, the script auto-runs db:backfill-embeddings via
subprocess so the new decisions are immediately searchable. Backfill
failure is caught and warned about (seed itself still succeeds).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `listProjects()` query helper

**Files:**
- Create: `src/db/queries/projects.ts`

- [ ] **Step 1: Write the file**

```typescript
import "server-only";
import { asc } from "drizzle-orm";
import { db } from "../client";
import { projects, type Project } from "../schema";

/* All registered projects, ordered by slug. Used by the Cross-Impact view
   header and any future multi-project switcher. */
export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(asc(projects.slug));
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /home/gary/repos/resolve add src/db/queries/projects.ts
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: add listProjects() query helper

Used by the Cross-Impact view to render the project header line
and (eventually) by any project switcher. Trivial wrapper today;
the explicit module gives future filters/joins a home.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Impact queries (TDD)

**Files:**
- Create: `src/db/queries/impact.ts`
- Create: `src/db/queries/impact.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/queries/impact.test.ts`:
```typescript
import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import { decisions, projects } from "../schema";
import {
  getImpactRadius,
  getCrossProjectImpactPairs,
  IMPACT_MIN_SHARED_TAGS,
} from "./impact";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;

const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

const PROJECT_A_ID = "00000000-0000-0000-0000-0000000aaaa1";
const PROJECT_B_ID = "00000000-0000-0000-0000-0000000aaaa2";
const PROJECT_C_ID = "00000000-0000-0000-0000-0000000aaaa3";

const DECISION_A1_ID = "00000000-0000-0000-0000-00000000bbb1";
const DECISION_A2_ID = "00000000-0000-0000-0000-00000000bbb2";
const DECISION_B1_ID = "00000000-0000-0000-0000-00000000bbb3";
const DECISION_B2_ID = "00000000-0000-0000-0000-00000000bbb4";
const DECISION_C1_ID = "00000000-0000-0000-0000-00000000bbb5";

const dummy = Buffer.alloc(32, 0x77);

describeDb("impact queries", () => {
  beforeAll(async () => {
    if (!DB_URL) return;
    client = postgres(DB_URL, { prepare: false });
    db = drizzle(client, { schema });

    // Clean any prior fixture rows
    await db
      .delete(decisions)
      .where(
        sql`${decisions.projectId} IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${PROJECT_C_ID})`,
      );
    await db
      .delete(projects)
      .where(
        sql`${projects.id} IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${PROJECT_C_ID})`,
      );

    await db.insert(projects).values([
      {
        id: PROJECT_A_ID,
        slug: "impact-test-a",
        name: "Project A",
        accentColor: "#aaaaaa",
      },
      {
        id: PROJECT_B_ID,
        slug: "impact-test-b",
        name: "Project B",
        accentColor: "#bbbbbb",
      },
      {
        id: PROJECT_C_ID,
        slug: "impact-test-c",
        name: "Project C",
        accentColor: "#cccccc",
      },
    ]);

    await db.insert(decisions).values([
      // A1: Postgres + concurrency + advisory-lock (shares 3 with B1, 0 with B2, 1 with C1)
      {
        id: DECISION_A1_ID,
        projectId: PROJECT_A_ID,
        title: "A1: advisory locks",
        rationale: "fixture",
        status: "committed",
        tags: ["Postgres", "concurrency", "advisory-lock"],
        author: "test",
        chainPosition: 1,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-04-01T00:00:00Z"),
      },
      // A2: redis (shares 0 with everything in B and C)
      {
        id: DECISION_A2_ID,
        projectId: PROJECT_A_ID,
        title: "A2: redis cache",
        rationale: "fixture",
        status: "committed",
        tags: ["redis", "cache"],
        author: "test",
        chainPosition: 2,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-04-02T00:00:00Z"),
      },
      // B1: Postgres + concurrency + advisory-lock + queue (shares 3 with A1)
      {
        id: DECISION_B1_ID,
        projectId: PROJECT_B_ID,
        title: "B1: pg locks",
        rationale: "fixture",
        status: "committed",
        tags: ["Postgres", "concurrency", "advisory-lock", "queue"],
        author: "test",
        chainPosition: 1,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-04-03T00:00:00Z"),
      },
      // B2: Postgres + queue (shares 1 with A1, below MIN_SHARED_TAGS)
      {
        id: DECISION_B2_ID,
        projectId: PROJECT_B_ID,
        title: "B2: pg queue",
        rationale: "fixture",
        status: "committed",
        tags: ["Postgres", "queue"],
        author: "test",
        chainPosition: 2,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-04-04T00:00:00Z"),
      },
      // C1: Postgres + concurrency (shares 2 with A1 — exactly at MIN)
      {
        id: DECISION_C1_ID,
        projectId: PROJECT_C_ID,
        title: "C1: pg concurrency",
        rationale: "fixture",
        status: "committed",
        tags: ["Postgres", "concurrency"],
        author: "test",
        chainPosition: 1,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-04-05T00:00:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    if (!client) return;
    await db
      .delete(decisions)
      .where(
        sql`${decisions.projectId} IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${PROJECT_C_ID})`,
      );
    await db
      .delete(projects)
      .where(
        sql`${projects.id} IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${PROJECT_C_ID})`,
      );
    await client.end();
  });

  itDb("MIN_SHARED_TAGS is 2 (locks the v1 default)", () => {
    expect(IMPACT_MIN_SHARED_TAGS).toBe(2);
  });

  itDb("getImpactRadius returns cross-project decisions sharing >= 2 tags", async () => {
    const items = await getImpactRadius(DECISION_A1_ID);
    // A1 shares 3 tags with B1 (top), 2 with C1, 1 with B2 (excluded by min).
    // A2 is same project — excluded.
    expect(items.map((i) => i.title)).toEqual(["B1: pg locks", "C1: pg concurrency"]);
    expect(items[0].sharedTags.sort()).toEqual(
      ["Postgres", "advisory-lock", "concurrency"].sort(),
    );
    expect(items[1].sharedTags.sort()).toEqual(["Postgres", "concurrency"]);
  });

  itDb("getImpactRadius excludes the source project", async () => {
    const items = await getImpactRadius(DECISION_A1_ID);
    expect(items.every((i) => i.projectSlug !== "impact-test-a")).toBe(true);
  });

  itDb("getImpactRadius returns [] for a tagless decision (no overlap possible)", async () => {
    // Insert a tagless decision in project A.
    const TAGLESS_ID = "00000000-0000-0000-0000-00000000bbb9";
    await db.insert(decisions).values({
      id: TAGLESS_ID,
      projectId: PROJECT_A_ID,
      title: "tagless",
      rationale: "fixture",
      status: "committed",
      tags: [],
      author: "test",
      chainPosition: 99,
      contentHash: dummy,
      prevHash: Buffer.alloc(32, 0),
      entryHash: dummy,
      committedAt: new Date("2026-04-09T00:00:00Z"),
    });
    const items = await getImpactRadius(TAGLESS_ID);
    expect(items).toEqual([]);
  });

  itDb("getCrossProjectImpactPairs returns all qualifying pairs sorted by shared count", async () => {
    const pairs = await getCrossProjectImpactPairs();
    // Only fixture-relevant pairs: A1↔B1 (3 shared), A1↔C1 (2 shared).
    // Filter to fixture rows so other prod data doesn't pollute the assertion.
    const fixtureSlugs = new Set(["impact-test-a", "impact-test-b", "impact-test-c"]);
    const fixturePairs = pairs.filter(
      (p) => fixtureSlugs.has(p.a.projectSlug) && fixtureSlugs.has(p.b.projectSlug),
    );
    expect(fixturePairs).toHaveLength(2);
    expect(fixturePairs[0].sharedTags.length).toBeGreaterThanOrEqual(
      fixturePairs[1].sharedTags.length,
    );
    const titles = fixturePairs.map((p) => [p.a.title, p.b.title].sort().join("|"));
    expect(titles).toContain(["A1: advisory locks", "B1: pg locks"].sort().join("|"));
    expect(titles).toContain(["A1: advisory locks", "C1: pg concurrency"].sort().join("|"));
  });

  itDb("getCrossProjectImpactPairs returns no same-project pairs", async () => {
    const pairs = await getCrossProjectImpactPairs();
    expect(pairs.every((p) => p.a.projectSlug !== p.b.projectSlug)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
pnpm test src/db/queries/impact.test.ts
```
Expected: `Cannot find module './impact'`.

- [ ] **Step 3: Implement the queries**

Create `src/db/queries/impact.ts`:
```typescript
import "server-only";
import { and, arrayOverlaps, eq, ne } from "drizzle-orm";
import { db } from "../client";
import { decisions, projects } from "../schema";

export const IMPACT_MIN_SHARED_TAGS = 2;

export type ImpactItem = {
  id: string;
  title: string;
  rationale: string;
  tags: string[];
  committedAt: Date | null;
  projectSlug: string;
  projectName: string;
  projectAccentColor: string;
  sharedTags: string[];
};

export type ImpactEndpoint = {
  id: string;
  title: string;
  tags: string[];
  projectSlug: string;
  projectName: string;
  projectAccentColor: string;
};

export type ImpactPair = {
  a: ImpactEndpoint;
  b: ImpactEndpoint;
  sharedTags: string[];
};

/* Cross-project decisions (committed) sharing >= IMPACT_MIN_SHARED_TAGS tags
   with the given decision. Sorted by shared-tag count desc, then committedAt
   desc. Returns [] if the source decision is missing or tagless. */
export async function getImpactRadius(
  decisionId: string,
): Promise<ImpactItem[]> {
  const [source] = await db
    .select({
      projectId: decisions.projectId,
      tags: decisions.tags,
    })
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1);

  if (!source || source.tags.length === 0) return [];

  // Postgres `&&` overlap operator narrows to candidates with >=1 shared tag.
  // Application code computes the actual shared-count (Postgres has no
  // single-expression way to count array intersection without an extension).
  const candidates = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
      tags: decisions.tags,
      committedAt: decisions.committedAt,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccentColor: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(
      and(
        ne(decisions.projectId, source.projectId),
        eq(decisions.status, "committed"),
        arrayOverlaps(decisions.tags, source.tags),
      ),
    );

  const sourceTagSet = new Set(source.tags);
  return candidates
    .map((c) => ({
      ...c,
      sharedTags: c.tags.filter((t) => sourceTagSet.has(t)),
    }))
    .filter((c) => c.sharedTags.length >= IMPACT_MIN_SHARED_TAGS)
    .sort((a, b) => {
      if (b.sharedTags.length !== a.sharedTags.length) {
        return b.sharedTags.length - a.sharedTags.length;
      }
      const aT = a.committedAt?.getTime() ?? 0;
      const bT = b.committedAt?.getTime() ?? 0;
      return bT - aT;
    });
}

/* All unique pairs of committed decisions across different projects sharing
   >= IMPACT_MIN_SHARED_TAGS tags. Sorted by shared count desc.

   v1: O(n^2) JS pass over all committed decisions. Acceptable while the
   committed-decision count is small (<10k). When this gets slow, push the
   intersection into Postgres via a recursive CTE or a materialized view. */
export async function getCrossProjectImpactPairs(): Promise<ImpactPair[]> {
  const rows = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      tags: decisions.tags,
      projectId: decisions.projectId,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccentColor: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(eq(decisions.status, "committed"));

  const pairs: ImpactPair[] = [];
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (a.tags.length === 0) continue;
    const aTagSet = new Set(a.tags);
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (a.projectId === b.projectId) continue;
      const sharedTags = b.tags.filter((t) => aTagSet.has(t));
      if (sharedTags.length < IMPACT_MIN_SHARED_TAGS) continue;
      pairs.push({
        a: {
          id: a.id,
          title: a.title,
          tags: a.tags,
          projectSlug: a.projectSlug,
          projectName: a.projectName,
          projectAccentColor: a.projectAccentColor,
        },
        b: {
          id: b.id,
          title: b.title,
          tags: b.tags,
          projectSlug: b.projectSlug,
          projectName: b.projectName,
          projectAccentColor: b.projectAccentColor,
        },
        sharedTags,
      });
    }
  }
  return pairs.sort((x, y) => y.sharedTags.length - x.sharedTags.length);
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm test src/db/queries/impact.test.ts
```
Expected: 6 passing.

If `arrayOverlaps` is not exported from `drizzle-orm` (unlikely on 0.45+ but possible on older versions), replace the import line and the `arrayOverlaps(...)` call with raw SQL:
```typescript
import { sql } from "drizzle-orm";
// ...
sql`${decisions.tags} && ${source.tags}::text[]`
```

- [ ] **Step 5: Run full suite + typecheck**

```bash
pnpm typecheck && pnpm test
```
Expected: typecheck clean, all tests passing (existing 26 + 6 new = 32).

- [ ] **Step 6: Commit**

```bash
git -C /home/gary/repos/resolve add src/db/queries/impact.ts src/db/queries/impact.test.ts
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: add impact queries (per-decision radius + cross-project pairs)

Two queries on the existing schema, no migrations:

- getImpactRadius(id): cross-project committed decisions sharing
  >= IMPACT_MIN_SHARED_TAGS tags with the given decision. Postgres
  arrayOverlaps narrows the candidate set; JS computes the actual
  shared count and ranks. Returns [] for tagless or missing decisions.

- getCrossProjectImpactPairs(): all unique cross-project pairs of
  committed decisions sharing >= MIN tags. v1 is an O(n^2) JS pass
  over all committed decisions — acceptable while the corpus is
  small (<10k). When this gets slow, push intersection into Postgres
  via a recursive CTE or materialized view.

IMPACT_MIN_SHARED_TAGS is hardcoded at 2 — the threshold is a v1
tuning decision worth revisiting once we have signal on whether
results feel too noisy (lower N) or too sparse (raise N).

Tests use a 3-project, 5-decision fixture in the same self-cleaning
beforeAll/afterAll pattern as src/db/queries/search.test.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Impact Panel component

**Files:**
- Create: `src/components/impact-panel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/impact-panel.tsx`:
```typescript
import Link from "next/link";
import {
  getImpactRadius,
  IMPACT_MIN_SHARED_TAGS,
  type ImpactItem,
} from "@/db/queries/impact";

/* Server component panel for the Decision Detail page. Fetches the impact
   radius for `decisionId` and renders the top items with shared tags
   highlighted in Reasoning Indigo. Empty state explains the threshold so
   users understand why the panel might be empty. */
export async function ImpactPanel({ decisionId }: { decisionId: string }) {
  const items = await getImpactRadius(decisionId);

  if (items.length === 0) {
    return (
      <section
        aria-label="Cross-project impact"
        className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-steel-edge bg-iron-panel p-5"
      >
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          Cross-project impact
        </p>
        <p className="text-sm text-zinc-whisper">
          No committed decisions in other projects share ≥
          {IMPACT_MIN_SHARED_TAGS} tags with this one yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Cross-project impact"
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          Cross-project impact
        </p>
        <span className="text-xs text-zinc-whisper">
          {items.length} match{items.length === 1 ? "" : "es"} · ≥
          {IMPACT_MIN_SHARED_TAGS} shared tags
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ImpactCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ImpactCard({ item }: { item: ImpactItem }) {
  const sharedSet = new Set(item.sharedTags);
  return (
    <li className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Link
          href={`/decisions/${item.id}`}
          className="text-sm font-medium text-cloud-white hover:text-reasoning-indigo"
        >
          {item.title}
        </Link>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-mono"
          style={{
            color: item.projectAccentColor,
            borderColor: item.projectAccentColor,
          }}
          title={`Project: ${item.projectName}`}
        >
          {item.projectName}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.tags.map((tag) => {
          const shared = sharedSet.has(tag);
          return (
            <span
              key={tag}
              className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                shared
                  ? "border-reasoning-indigo bg-reasoning-indigo/15 text-reasoning-indigo"
                  : "border-frost-line text-zinc-whisper"
              }`}
            >
              {tag}
            </span>
          );
        })}
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /home/gary/repos/resolve add src/components/impact-panel.tsx
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: add ImpactPanel server component

Renders the cross-project impact radius for one decision. Each impact
item card shows the cross-project decision title (linked), the
owning project (chip styled with the project's accent color), and
the decision's tags — shared tags highlighted in Reasoning Indigo so
the connection back to the source decision is visually obvious.

Empty state surfaces the IMPACT_MIN_SHARED_TAGS threshold so users
understand why the panel might be empty, rather than thinking the
feature is broken.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Wire ImpactPanel into Decision Detail

**Files:**
- Modify: `src/app/decisions/[id]/page.tsx`

- [ ] **Step 1: Add import + render the panel**

Open `src/app/decisions/[id]/page.tsx`. Add to the existing imports near the top:
```typescript
import { ImpactPanel } from "@/components/impact-panel";
```

Then find the `</section>` that closes the chain-entry block (the one with `aria-label="Chain entry"`). Immediately after that closing `</section>`, BEFORE the `{decision.status === "committed" && !onChain && (` block, insert:
```tsx
      <ImpactPanel decisionId={decision.id} />
```

Final ordering in the page body should be:
1. Header (title + status badge)
2. Rationale article
3. Metadata section
4. Chain entry section (when on-chain)
5. **ImpactPanel** ← new
6. Off-chain warning section (when applicable)
7. Commit button (when proposed)

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```
In another terminal, get a decision id:
```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { prepare: false });
(async () => {
  const r = await sql\`SELECT id, title FROM decisions WHERE status = 'committed' ORDER BY created_at LIMIT 5\`;
  console.log(r);
  await sql.end();
})();
"
```
Open `http://localhost:3000/decisions/<id>` for one of the listed ids — the page should render with the new "Cross-project impact" panel between the chain entry box and the bottom of the page. For the original Resolve decisions tagged Postgres/Supabase/etc., the panel should show the seeded baker-street decisions; for tagless or non-overlapping decisions it should show the empty-state copy.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git -C /home/gary/repos/resolve add 'src/app/decisions/[id]/page.tsx'
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: render ImpactPanel on the Decision Detail page

Inserts the cross-project impact panel between the chain-entry box
and the off-chain/proposed sections. Server-rendered alongside the
rest of the page — no client component, no waterfall.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Cross-Impact view page

**Files:**
- Create: `src/app/cross-impact/page.tsx`

- [ ] **Step 1: Write the page**

```bash
mkdir -p /home/gary/repos/resolve/src/app/cross-impact
```

Create `src/app/cross-impact/page.tsx`:
```typescript
import Link from "next/link";
import {
  getCrossProjectImpactPairs,
  IMPACT_MIN_SHARED_TAGS,
  type ImpactEndpoint,
} from "@/db/queries/impact";
import { listProjects } from "@/db/queries/projects";

export const dynamic = "force-dynamic";

export default async function CrossImpactPage() {
  const [pairs, projects] = await Promise.all([
    getCrossProjectImpactPairs(),
    listProjects(),
  ]);

  return (
    <main className="flex flex-1 flex-col w-full max-w-[1200px] mx-auto px-8 py-12 gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          resolve · cross-impact
        </p>
        <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-cloud-white">
          Cross-project impact
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-silver-mist">
          Pairs of committed decisions across different projects that share ≥
          {IMPACT_MIN_SHARED_TAGS} tags. {pairs.length} pair
          {pairs.length === 1 ? "" : "s"} across {projects.length} project
          {projects.length === 1 ? "" : "s"}.
        </p>
      </header>

      {pairs.length === 0 ? (
        <section
          aria-label="No impact yet"
          className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-6"
        >
          <p className="text-sm text-silver-mist">
            No cross-project pairs yet. Record committed decisions in different
            projects with overlapping tags — pairs sharing ≥
            {IMPACT_MIN_SHARED_TAGS} tags will appear here automatically.
          </p>
        </section>
      ) : (
        <ol className="flex flex-col gap-4">
          {pairs.map((pair) => (
            <li
              key={`${pair.a.id}-${pair.b.id}`}
              className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-5"
            >
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="font-mono text-reasoning-indigo">
                  {pair.sharedTags.length} shared
                </span>
                <span className="text-zinc-whisper">·</span>
                <div className="flex flex-wrap gap-1.5">
                  {pair.sharedTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-reasoning-indigo bg-reasoning-indigo/15 px-2 py-0.5 font-mono text-xs text-reasoning-indigo"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <EndpointCard endpoint={pair.a} sharedTags={pair.sharedTags} />
                <EndpointCard endpoint={pair.b} sharedTags={pair.sharedTags} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function EndpointCard({
  endpoint,
  sharedTags,
}: {
  endpoint: ImpactEndpoint;
  sharedTags: string[];
}) {
  const sharedSet = new Set(sharedTags);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-frost-line bg-iron-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/decisions/${endpoint.id}`}
          className="text-sm font-medium text-cloud-white hover:text-reasoning-indigo"
        >
          {endpoint.title}
        </Link>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-mono"
          style={{
            color: endpoint.projectAccentColor,
            borderColor: endpoint.projectAccentColor,
          }}
        >
          {endpoint.projectName}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {endpoint.tags.map((t) => (
          <span
            key={t}
            className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
              sharedSet.has(t)
                ? "border-reasoning-indigo bg-reasoning-indigo/15 text-reasoning-indigo"
                : "border-frost-line text-zinc-whisper"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```
Open `http://localhost:3000/cross-impact`. Expect:
- Page header with the count: "N pairs across 2 projects"
- One row per pair (A1 ↔ B1 from Resolve↔Baker Street will be the obvious one)
- Each row: shared tag chips at top (Reasoning Indigo), two-column endpoint cards below
- Each endpoint card: title (linked), project chip in project accent color, full tag list with shared ones highlighted

Stop dev server when done.

- [ ] **Step 4: Commit**

```bash
git -C /home/gary/repos/resolve add src/app/cross-impact/
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: add /cross-impact view (columnar pair list)

Server component listing all cross-project decision pairs sharing
>= IMPACT_MIN_SHARED_TAGS tags. v1 layout is two-column endpoint
cards per row — explicitly NOT a force-directed graph. The columnar
form scans well, makes shared-tag highlighting trivial, and avoids
the v1.x layout-engine + click-target work a real graph would need.

Empty state explains the threshold and prompts the user to record
overlapping decisions, so the page is informative even before any
cross-project data exists.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Nav link + footer milestone bump

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add Cross-Impact nav link**

Open `src/app/page.tsx`. In the header `<div className="flex items-center gap-3">` block (currently containing Chain Status, Search, and Record Decision links), insert a Cross-Impact link between Search and Record Decision. Find:
```tsx
          <Link
            href="/search"
            className="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-frost-line bg-transparent px-5 text-sm font-medium text-cloud-white transition-colors hover:bg-iron-panel"
          >
            Search
          </Link>
          <Link
            href="/decisions/new"
```

Replace with:
```tsx
          <Link
            href="/search"
            className="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-frost-line bg-transparent px-5 text-sm font-medium text-cloud-white transition-colors hover:bg-iron-panel"
          >
            Search
          </Link>
          <Link
            href="/cross-impact"
            className="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-frost-line bg-transparent px-5 text-sm font-medium text-cloud-white transition-colors hover:bg-iron-panel"
          >
            Cross-Impact
          </Link>
          <Link
            href="/decisions/new"
```

- [ ] **Step 2: Bump footer milestone label**

In the same file, find:
```tsx
        <span>Milestone M3 — Search</span>
```
Replace with:
```tsx
        <span>Milestone M4 — Cross-project</span>
```

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C /home/gary/repos/resolve add src/app/page.tsx
git -C /home/gary/repos/resolve commit -m "$(cat <<'EOF'
M4: add Cross-Impact nav link, bump footer milestone label

Cross-Impact slots between Search and Record Decision in the home
header (same outline style as Search and Chain Status — read-only
navigation, not a primary action). Footer milestone marker advances
from M3 to M4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — Final verification

- [ ] **Step 1: Full quality gate**

```bash
pnpm typecheck && pnpm lint && pnpm test
```
Expected: typecheck clean, lint clean, **32/32 tests passing** (17 chain + 5 voyage + 4 search + 6 impact).

- [ ] **Step 2: Confirm M4 exit criterion in dev**

```bash
pnpm dev
```
Walk through:
1. `http://localhost:3000/` → see new "Cross-Impact" nav button + "Milestone M4 — Cross-project" footer.
2. Click "Cross-Impact" → `/cross-impact` lists pairs (at least the baker-street ↔ resolve pairs from the seed).
3. Click any decision link in a pair → Decision Detail renders with the new impact panel below the chain entry; shared tags are highlighted.
4. Click an `Adopt Supabase…` decision (or similar Resolve seed) → impact panel shows the baker-street decisions with overlapping tags.

Stop dev server when done.

- [ ] **Step 3: Confirm git state is ready for PR**

```bash
git -C /home/gary/repos/resolve log --oneline main..HEAD
git -C /home/gary/repos/resolve status --short
```
Expected: ~7 commits on `feat/m4-cross-project`, working tree clean.

---

## Definition of Done (M4 exit criterion)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` — 32/32 passing
- [ ] `pnpm db:seed` is idempotent (re-runnable without errors)
- [ ] `baker-street` project + 3 sample decisions exist in dev DB with embeddings populated
- [ ] `/cross-impact` lists ≥1 cross-project pair
- [ ] Decision Detail panel renders cross-project items with shared-tag highlighting
- [ ] PRD §8 exit criterion met: *"Two registered projects with linked decisions render correctly"*

## Notes & Caveats

- **No schema changes.** M4 is pure read-layer + UI on top of M3's tag schema. If a future milestone needs persistent supersession/amendment edges, schema changes land then.
- **O(n²) pair scan.** `getCrossProjectImpactPairs` is fine while the committed-decision count is small. When this gets slow (>10k committed decisions across all projects), push intersection into a Postgres recursive CTE or a materialized view refreshed on commit.
- **MIN=2 is a v1 default.** If the impact panel feels too noisy in production, raise to 3. If it feels too sparse, lower to 1 (and watch for noise from generic tags like "Postgres" appearing in 80% of decisions).
- **Real graph view deferred.** Columnar pair list is the v1; force-directed or DAG layout is a v1.1 concern after the data shape and signal:noise ratio are understood.
- **Supersession/amendment lifecycle deferred.** PRD §5.1 + §5.2 mention `superseded_by` / `amends` FK columns and `amended` / `superseded` enum values. Out of M4 scope; defer to M4.5 or a dedicated lifecycle milestone.
- **Seed dummy chain hashes.** The 3 baker-street seeded decisions use `0xee` placeholder hashes — they're committed-status for query purposes but not part of the real M2 SHA-256 chain. The /chain page for baker-street will show these placeholders. Acceptable for seed data; the M2 chain is for UI-recorded decisions, not seed data.
