import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "../schema";
import { decisions, projects } from "../schema";
import { listDecisionsFiltered } from "./decisions";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;

const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

const PROJECT_ID = "00000000-0000-0000-0000-0000000fff01";
const DECISION_1 = "00000000-0000-0000-0000-00000000ff01";
const DECISION_2 = "00000000-0000-0000-0000-00000000ff02";
const DECISION_3 = "00000000-0000-0000-0000-00000000ff03";

const dummy = Buffer.alloc(32, 0x77);

describeDb("listDecisionsFiltered", () => {
  beforeAll(async () => {
    if (!DB_URL) return;
    client = postgres(DB_URL, { prepare: false });
    db = drizzle(client, { schema });

    await db
      .delete(decisions)
      .where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);

    await db.insert(projects).values({
      id: PROJECT_ID,
      slug: "filter-test",
      name: "Filter Test",
      accentColor: "#000000",
    });

    await db.insert(decisions).values([
      {
        id: DECISION_1,
        projectId: PROJECT_ID,
        title: "Use Postgres",
        rationale: "Relational fits the data.",
        tags: ["Postgres", "database"],
        author: "tester",
        status: "committed",
        chainPosition: 1,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: DECISION_2,
        projectId: PROJECT_ID,
        title: "Use pgvector",
        rationale: "Embeddings live next to rows.",
        tags: ["Postgres", "pgvector"],
        author: "tester",
        status: "committed",
        chainPosition: 2,
        contentHash: dummy,
        prevHash: dummy,
        entryHash: dummy,
        committedAt: new Date("2026-02-01T00:00:00Z"),
      },
      {
        id: DECISION_3,
        projectId: PROJECT_ID,
        title: "Draft: consider Redis",
        rationale: "Not sure yet.",
        tags: ["Redis"],
        author: "tester",
        status: "proposed",
      },
    ]);
  });

  afterAll(async () => {
    if (!DB_URL) return;
    await db
      .delete(decisions)
      .where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);
    await client.end();
  });

  itDb("returns all decisions when no filters", async () => {
    const rows = await listDecisionsFiltered({ projectSlug: "filter-test" });
    expect(rows.length).toBe(3);
  });

  itDb("filters by status", async () => {
    const rows = await listDecisionsFiltered({
      projectSlug: "filter-test",
      status: "committed",
    });
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.chainPosition !== null)).toBe(true);
  });

  itDb("filters by tags (AND semantics)", async () => {
    const rows = await listDecisionsFiltered({
      projectSlug: "filter-test",
      tags: ["Postgres", "pgvector"],
    });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(DECISION_2);
  });

  itDb("filters by committedAt range", async () => {
    const rows = await listDecisionsFiltered({
      projectSlug: "filter-test",
      status: "committed",
      from: new Date("2026-01-15T00:00:00Z"),
    });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(DECISION_2);
  });

  itDb("respects limit", async () => {
    const rows = await listDecisionsFiltered({
      projectSlug: "filter-test",
      limit: 1,
    });
    expect(rows.length).toBe(1);
  });
});
