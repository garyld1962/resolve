import "server-only";
import { asc } from "drizzle-orm";
import { db } from "../client";
import { projects, type Project } from "../schema";

/* All registered projects, ordered by slug. Used by the Cross-Impact view
   header and any future multi-project switcher. */
export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(asc(projects.slug));
}
