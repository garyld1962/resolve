import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { decisions, projects } from "@/db/schema";

// Hoisted spy — vitest lifts vi.mock above imports, so the spy must be
// declared via vi.hoisted() to be accessible inside the mock factory.
const { embedSpy } = vi.hoisted(() => ({
  embedSpy: vi.fn(async (_texts: string[], _type: string) =>
    [new Array(1024).fill(0.5)] as number[][],
  ),
}));
vi.mock("@/lib/voyage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voyage")>(
    "@/lib/voyage",
  );
  return { ...actual, embed: embedSpy };
});

import { queryDecisionsTool } from "./query-decisions";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;
const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

const PROJECT_ID = "00000000-0000-0000-0000-0000000dd003";

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

const dummy = Buffer.alloc(32, 0x77);
const embedding1024 = new Array(1024).fill(0.5) as number[];

describeDb("queryDecisionsTool", () => {
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
      slug: "query-test",
      name: "Query Test",
      accentColor: "#000000",
    });
    await db.insert(decisions).values([
      {
        projectId: PROJECT_ID,
        title: "Use Postgres",
        rationale: "fits",
        tags: ["Postgres"],
        author: "t",
        status: "committed",
        chainPosition: 1,
        contentHash: dummy,
        prevHash: Buffer.alloc(32, 0),
        entryHash: dummy,
        committedAt: new Date(),
        embedding: embedding1024,
      },
      {
        projectId: PROJECT_ID,
        title: "Add Redis",
        rationale: "queue",
        tags: ["Redis"],
        author: "t",
        status: "committed",
        chainPosition: 2,
        contentHash: dummy,
        prevHash: dummy,
        entryHash: dummy,
        committedAt: new Date(),
        embedding: embedding1024,
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

  itDb("filter mode returns rows with similarity=null", async () => {
    embedSpy.mockClear();
    const res = await queryDecisionsTool.handler({ project: "query-test" });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.items.length).toBe(2);
    expect(payload.items.every((x: { similarity: unknown }) => x.similarity === null)).toBe(true);
    expect(embedSpy).not.toHaveBeenCalled();
  });

  itDb("semantic mode populates similarity between 0 and 1", async () => {
    embedSpy.mockClear();
    const res = await queryDecisionsTool.handler({
      project: "query-test",
      query: "database choice",
    });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.items.length).toBeGreaterThan(0);
    expect(embedSpy).toHaveBeenCalledWith(["database choice"], "query");
    for (const item of payload.items) {
      expect(typeof item.similarity).toBe("number");
      expect(item.similarity).toBeGreaterThanOrEqual(0);
      expect(item.similarity).toBeLessThanOrEqual(1);
    }
  });

  itDb("tag filter narrows results (AND semantics)", async () => {
    const res = await queryDecisionsTool.handler({
      project: "query-test",
      tags: ["Postgres"],
    });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].title).toBe("Use Postgres");
  });

  itDb("rejects invalid status enum", async () => {
    await expect(
      queryDecisionsTool.handler({
        project: "query-test",
        status: "banana",
      } as unknown as Parameters<typeof queryDecisionsTool.handler>[0]),
    ).rejects.toThrow();
  });

  itDb("caps limit at 100", async () => {
    await expect(
      queryDecisionsTool.handler({ project: "query-test", limit: 500 }),
    ).rejects.toThrow();
  });
});
