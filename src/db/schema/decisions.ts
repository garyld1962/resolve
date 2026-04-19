import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  bigint,
  customType,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

/* Postgres bytea as Buffer — used for 32-byte SHA-256 hashes (content/prev/entry). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/* M1 lifecycle: proposed (mutable draft) → committed (hashed into chain, immutable).
   amended / superseded arrive in later milestones. */
export const decisionStatus = pgEnum("decision_status", [
  "proposed",
  "committed",
]);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    status: decisionStatus("status").notNull().default("proposed"),
    tags: text("tags").array().notNull().default([]),
    linearIssueIds: text("linear_issue_ids").array().notNull().default([]),
    author: text("author").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),

    /* Chain fields — null while proposed, populated atomically at commit time.
       chain_position is monotonic per project (not global) and enforced unique
       by the (project_id, chain_position) index below. entry_hash =
       sha256(content_hash ‖ prev_hash ‖ chain_position_be_u64). */
    chainPosition: bigint("chain_position", { mode: "number" }),
    contentHash: bytea("content_hash"),
    prevHash: bytea("prev_hash"),
    entryHash: bytea("entry_hash"),

    /* M3: Voyage embedding of (title + "\n\n" + rationale) at commit time.
       NULL until embedded — backfill script fills gaps if Voyage is down. */
    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (t) => [
    index("decisions_project_id_idx").on(t.projectId),
    index("decisions_status_idx").on(t.status),
    index("decisions_created_at_idx").on(t.createdAt.desc()),
    uniqueIndex("decisions_chain_position_per_project_idx").on(
      t.projectId,
      t.chainPosition,
    ),
    index("decisions_embedding_idx")
      .using("hnsw", t.embedding.op("vector_cosine_ops"))
      .where(sql`${t.embedding} IS NOT NULL`),
  ],
);

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type DecisionStatus = (typeof decisionStatus.enumValues)[number];
