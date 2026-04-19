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
