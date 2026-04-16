import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { decisions, projects, type NewDecision } from "../schema";

export async function listDecisionsByProjectSlug(projectSlug: string) {
  return db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
      status: decisions.status,
      tags: decisions.tags,
      linearIssueIds: decisions.linearIssueIds,
      author: decisions.author,
      createdAt: decisions.createdAt,
      committedAt: decisions.committedAt,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccent: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(eq(projects.slug, projectSlug))
    .orderBy(desc(decisions.createdAt));
}

export type DecisionListItem = Awaited<
  ReturnType<typeof listDecisionsByProjectSlug>
>[number];

export async function getDecisionById(id: string) {
  const rows = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
      status: decisions.status,
      tags: decisions.tags,
      linearIssueIds: decisions.linearIssueIds,
      author: decisions.author,
      createdAt: decisions.createdAt,
      committedAt: decisions.committedAt,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccent: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(eq(decisions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type DecisionDetail = NonNullable<
  Awaited<ReturnType<typeof getDecisionById>>
>;

export async function getProjectIdBySlug(slug: string) {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function createDecision(input: {
  projectSlug: string;
  title: string;
  rationale: string;
  tags: string[];
  linearIssueIds: string[];
  author: string;
}): Promise<{ id: string }> {
  const projectId = await getProjectIdBySlug(input.projectSlug);
  if (!projectId) {
    throw new Error(`Unknown project slug: ${input.projectSlug}`);
  }
  const values: NewDecision = {
    projectId,
    title: input.title,
    rationale: input.rationale,
    tags: input.tags,
    linearIssueIds: input.linearIssueIds,
    author: input.author,
  };
  const [row] = await db
    .insert(decisions)
    .values(values)
    .returning({ id: decisions.id });
  return row;
}

/* Flip a proposed decision to committed. No chain hashing yet — that's M2.
   Returns the updated row, or null if the decision doesn't exist or is already committed. */
export async function commitDecision(id: string) {
  const [row] = await db
    .update(decisions)
    .set({ status: "committed", committedAt: new Date() })
    .where(and(eq(decisions.id, id), eq(decisions.status, "proposed")))
    .returning({ id: decisions.id, committedAt: decisions.committedAt });
  return row ?? null;
}
