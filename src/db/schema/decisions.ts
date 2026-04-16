import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

/* M1 lifecycle: proposed (mutable draft) → committed (immutable once hashed in M2).
   amended / superseded arrive in later milestones — not part of M1 exit criteria. */
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
  },
  (t) => [
    index("decisions_project_id_idx").on(t.projectId),
    index("decisions_status_idx").on(t.status),
    index("decisions_created_at_idx").on(t.createdAt.desc()),
  ],
);

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type DecisionStatus = (typeof decisionStatus.enumValues)[number];
