import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";

/* Registered projects that decisions are scoped to.
   Per PRD §4 (multi-project aware) and DESIGN.md §4 (Impact Radius project palette):
   each project gets an accent from a rotating palette on registration. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    accentColor: text("accent_color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("projects_slug_unique").on(t.slug)],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
