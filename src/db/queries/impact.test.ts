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
    const all = await getImpactRadius(DECISION_A1_ID);
    // Filter to fixture projects so any prod data sharing the same generic
    // Postgres/concurrency tags doesn't pollute the assertion.
    const fixtureSlugs = new Set([
      "impact-test-a",
      "impact-test-b",
      "impact-test-c",
    ]);
    const items = all.filter((i) => fixtureSlugs.has(i.projectSlug));
    // A1 shares 3 tags with B1 (top), 2 with C1, 1 with B2 (excluded by min).
    // A2 is same project — excluded.
    expect(items.map((i) => i.title)).toEqual([
      "B1: pg locks",
      "C1: pg concurrency",
    ]);
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
    // Filter to fixture rows so other prod data doesn't pollute the assertion.
    const fixtureSlugs = new Set([
      "impact-test-a",
      "impact-test-b",
      "impact-test-c",
    ]);
    const fixturePairs = pairs.filter(
      (p) =>
        fixtureSlugs.has(p.a.projectSlug) && fixtureSlugs.has(p.b.projectSlug),
    );
    // Three qualifying fixture pairs:
    //   A1↔B1 (3 shared: Postgres, concurrency, advisory-lock)
    //   A1↔C1 (2 shared: Postgres, concurrency)
    //   B1↔C1 (2 shared: Postgres, concurrency)
    expect(fixturePairs).toHaveLength(3);
    // Sorted by shared count desc, so the 3-shared pair comes first.
    expect(fixturePairs[0].sharedTags.length).toBe(3);
    expect(fixturePairs[1].sharedTags.length).toBe(2);
    expect(fixturePairs[2].sharedTags.length).toBe(2);
    const titles = fixturePairs.map((p) =>
      [p.a.title, p.b.title].sort().join("|"),
    );
    expect(titles).toContain(
      ["A1: advisory locks", "B1: pg locks"].sort().join("|"),
    );
    expect(titles).toContain(
      ["A1: advisory locks", "C1: pg concurrency"].sort().join("|"),
    );
    expect(titles).toContain(
      ["B1: pg locks", "C1: pg concurrency"].sort().join("|"),
    );
  });

  itDb("getCrossProjectImpactPairs returns no same-project pairs", async () => {
    const pairs = await getCrossProjectImpactPairs();
    expect(pairs.every((p) => p.a.projectSlug !== p.b.projectSlug)).toBe(true);
  });
});
