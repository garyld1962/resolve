import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import { decisions, projects } from "../schema";
import { searchDecisions } from "./search";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;

const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

const PROJECT_ID = "00000000-0000-0000-0000-00000000aaaa";
const PROJECT_SLUG = "search-test";

function vec(seed: number): number[] {
  // Deterministic 1024-d unit vector. Keeps tests reproducible without Voyage.
  const v = new Array(1024).fill(0).map((_, i) => Math.sin(seed + i * 0.001));
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  return v.map((x) => x / norm);
}

describeDb("searchDecisions", () => {
  beforeAll(async () => {
    if (!DB_URL) return;
    client = postgres(DB_URL, { prepare: false });
    db = drizzle(client, { schema });

    await db.delete(decisions).where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);
    await db.insert(projects).values({
      id: PROJECT_ID,
      slug: PROJECT_SLUG,
      name: "Search Test",
      accentColor: "#888888",
    });

    const rows = [
      { title: "Alpha", tags: ["nats"], seed: 0.0 as number | null },
      { title: "Bravo", tags: ["redis"], seed: 1.0 as number | null },
      { title: "Charlie", tags: ["nats", "kafka"], seed: 0.05 as number | null },
      { title: "Delta (no embedding)", tags: ["nats"], seed: null },
    ];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await db.insert(decisions).values({
        projectId: PROJECT_ID,
        title: r.title,
        rationale: "fixture",
        status: "committed",
        tags: r.tags,
        author: "test",
        chainPosition: i + 1,
        contentHash: Buffer.alloc(32, 1),
        prevHash: Buffer.alloc(32, 0),
        entryHash: Buffer.alloc(32, i + 2),
        embedding: r.seed === null ? null : vec(r.seed),
        committedAt: new Date(`2026-04-0${i + 1}T00:00:00Z`),
      });
    }
  });

  afterAll(async () => {
    if (!client) return;
    await db.delete(decisions).where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);
    await client.end();
  });

  itDb("returns top-K ordered by cosine similarity to the query vector", async () => {
    const results = await searchDecisions({
      queryVector: vec(0.0), // closest to Alpha (seed 0.0), then Charlie (seed 0.05)
      projectSlug: PROJECT_SLUG,
      limit: 3,
    });
    expect(results.map((r) => r.title)).toEqual(["Alpha", "Charlie", "Bravo"]);
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });

  itDb("excludes rows without an embedding", async () => {
    const results = await searchDecisions({
      queryVector: vec(0.0),
      projectSlug: PROJECT_SLUG,
      limit: 10,
    });
    expect(results.map((r) => r.title)).not.toContain("Delta (no embedding)");
  });

  itDb("filters by tag (intersection: row tags must include ALL given tags)", async () => {
    const results = await searchDecisions({
      queryVector: vec(0.0),
      projectSlug: PROJECT_SLUG,
      tags: ["nats", "kafka"],
      limit: 10,
    });
    expect(results.map((r) => r.title)).toEqual(["Charlie"]);
  });

  itDb("filters by date range (committedAt)", async () => {
    const results = await searchDecisions({
      queryVector: vec(0.0),
      projectSlug: PROJECT_SLUG,
      from: new Date("2026-04-02T00:00:00Z"),
      to: new Date("2026-04-03T23:59:59Z"),
      limit: 10,
    });
    expect(results.map((r) => r.title).sort()).toEqual(["Bravo", "Charlie"]);
  });
});
