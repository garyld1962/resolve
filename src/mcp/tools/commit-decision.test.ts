import "dotenv/config";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { decisions, projects } from "@/db/schema";

// Spy on the post-commit embed helper to assert `after()` schedules it.
// vi.hoisted() runs before vi.mock() hoisting, making embedSpy available in the factory.
const { embedSpy } = vi.hoisted(() => ({
  embedSpy: vi.fn(async (_id: string) => {}),
}));
vi.mock("@/db/queries/embeddings", async () => {
  const actual =
    await vi.importActual<typeof import("@/db/queries/embeddings")>(
      "@/db/queries/embeddings",
    );
  return { ...actual, embedDecisionAfterCommit: embedSpy };
});

// Mock next/server after() so the test process executes the scheduled
// callback instead of deferring it to a real post-response tick.
const afterCallbacks: Array<() => void | Promise<void>> = [];
vi.mock("next/server", () => ({
  after: (cb: () => void | Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

import { commitDecisionTool } from "./commit-decision";
import { createDecision } from "@/db/queries/decisions";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;
const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

const PROJECT_ID = "00000000-0000-0000-0000-0000000dd002";

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

describeDb("commitDecisionTool", () => {
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
      slug: "commit-test",
      name: "Commit Test",
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

  itDb("commits a proposed decision and schedules embed", async () => {
    afterCallbacks.length = 0;
    embedSpy.mockClear();

    const { id } = await createDecision({
      projectSlug: "commit-test",
      title: "X",
      rationale: "Y",
      tags: [],
      linearIssueIds: [],
      author: "tester",
    });
    const res = await commitDecisionTool.handler({ id });

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0].text);
    expect(payload.id).toBe(id);
    expect(payload.chain_position).toBeGreaterThanOrEqual(1);
    expect(payload.entry_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.committed_at).toMatch(/\d{4}-\d{2}-\d{2}T/);

    // Drain the after() queue and assert the embed fired for this id.
    for (const cb of afterCallbacks) await cb();
    expect(embedSpy).toHaveBeenCalledWith(id);
  });

  itDb("returns NOT_FOUND on unknown id", async () => {
    const res = await commitDecisionTool.handler({
      id: "00000000-0000-0000-0000-0000deadbeef",
    });
    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe("NOT_FOUND");
  });

  itDb("returns ALREADY_COMMITTED on double-commit", async () => {
    afterCallbacks.length = 0;
    const { id } = await createDecision({
      projectSlug: "commit-test",
      title: "Z",
      rationale: "W",
      tags: [],
      linearIssueIds: [],
      author: "tester",
    });
    const first = await commitDecisionTool.handler({ id });
    expect(first.isError).toBeUndefined();

    const second = await commitDecisionTool.handler({ id });
    expect(second.isError).toBe(true);
    const payload = JSON.parse(second.content[0].text);
    expect(payload.code).toBe("ALREADY_COMMITTED");
  });
});
