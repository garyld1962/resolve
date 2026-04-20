import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { decisions, projects } from "@/db/schema";
import { recordDecisionTool } from "./record-decision";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;
const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

const PROJECT_ID = "00000000-0000-0000-0000-0000000dd001";

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

describeDb("recordDecisionTool", () => {
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
      slug: "record-test",
      name: "Record Test",
      accentColor: "#000000",
    });
  });

  afterAll(async () => {
    if (!DB_URL) return;
    await db
      .delete(decisions)
      .where(sql`${decisions.projectId} = ${PROJECT_ID}`);
    await db.delete(projects).where(sql`${projects.id} = ${PROJECT_ID}`);
    await client.end();
  });

  itDb("creates a proposed decision and returns its id", async () => {
    const res = await recordDecisionTool.handler({
      project: "record-test",
      title: "Use Bun",
      rationale: "Fast",
      tags: ["runtime"],
      linear_issues: [],
      author: "agent-a",
    });
    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0].text);
    expect(payload.id).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    expect(payload.status).toBe("proposed");
  });

  itDb("trims + dedupes tags", async () => {
    const res = await recordDecisionTool.handler({
      project: "record-test",
      title: "With sloppy tags",
      rationale: "…",
      tags: ["  TypeScript  ", "TypeScript", " "],
      linear_issues: [],
      author: "agent-a",
    });
    const payload = JSON.parse(res.content[0].text);
    const [row] = await db
      .select({ tags: decisions.tags })
      .from(decisions)
      .where(sql`${decisions.id} = ${payload.id}`);
    expect(row.tags).toEqual(["TypeScript"]);
  });

  itDb("returns UNKNOWN_PROJECT when slug is invalid", async () => {
    const res = await recordDecisionTool.handler({
      project: "does-not-exist",
      title: "…",
      rationale: "…",
      tags: [],
      linear_issues: [],
      author: "agent-a",
    });
    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe("UNKNOWN_PROJECT");
  });

  itDb("rejects title over 120 chars via zod", async () => {
    const long = "x".repeat(121);
    await expect(
      recordDecisionTool.handler({
        project: "record-test",
        title: long,
        rationale: "…",
        tags: [],
        linear_issues: [],
        author: "agent-a",
      }),
    ).rejects.toThrow();
  });
});
