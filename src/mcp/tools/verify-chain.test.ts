import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { decisions, projects } from "@/db/schema";
import { verifyChainTool } from "./verify-chain";
import { createDecision, commitDecision } from "@/db/queries/decisions";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;
const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

const PROJECT_ID = "00000000-0000-0000-0000-0000000dd004";
const SLUG = "verify-test";

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

describeDb("verifyChainTool", () => {
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
      slug: SLUG,
      name: "Verify Test",
      accentColor: "#000000",
    });

    // Build a real 2-entry chain via the existing commit path.
    const { id: a } = await createDecision({
      projectSlug: SLUG,
      title: "A",
      rationale: "reasoning a",
      tags: [],
      linearIssueIds: [],
      author: "t",
    });
    await commitDecision(a);
    const { id: b } = await createDecision({
      projectSlug: SLUG,
      title: "B",
      rationale: "reasoning b",
      tags: [],
      linearIssueIds: [],
      author: "t",
    });
    await commitDecision(b);
  });

  afterAll(async () => {
    if (!DB_URL) return;
    await db
      .delete(decisions)
      .where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);
    await client.end();
  });

  itDb("verifies a healthy chain (single project)", async () => {
    const res = await verifyChainTool.handler({ project: SLUG });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.results.length).toBe(1);
    const r = payload.results[0];
    expect(r.project_slug).toBe(SLUG);
    expect(r.verified).toBe(true);
    expect(r.chain_length).toBe(2);
    expect(r.break_at).toBeNull();
    expect(r.merkle_root).toMatch(/^[0-9a-f]{64}$/);
  });

  itDb("detects a tampered entry", async () => {
    // Flip one byte of the second entry's content_hash in the DB.
    await db.execute(
      sql`UPDATE decisions SET content_hash = decode('00000000000000000000000000000000000000000000000000000000deadbeef', 'hex') WHERE project_id = ${PROJECT_ID} AND chain_position = 2`,
    );
    const res = await verifyChainTool.handler({ project: SLUG });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.results[0].verified).toBe(false);
    expect(payload.results[0].break_at).toBe(2);
  });

  itDb("returns UNKNOWN_PROJECT for a bad slug", async () => {
    const res = await verifyChainTool.handler({ project: "nope-nope-nope" });
    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe("UNKNOWN_PROJECT");
  });

  itDb("iterates all projects when project omitted", async () => {
    const res = await verifyChainTool.handler({});
    const payload = JSON.parse(res.content[0].text);
    expect(payload.results.length).toBeGreaterThanOrEqual(1);
    const slugs = payload.results.map((r: { project_slug: string }) => r.project_slug);
    expect(slugs).toContain(SLUG);
  });
});
