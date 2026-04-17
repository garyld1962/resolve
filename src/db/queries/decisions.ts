import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  decisions,
  projects,
  type Decision,
  type NewDecision,
} from "../schema";
import {
  computeExtension,
  type ChainHead,
  type DecisionContent,
} from "@/lib/chain";

const DECISION_LIST_SELECT = {
  id: decisions.id,
  title: decisions.title,
  rationale: decisions.rationale,
  status: decisions.status,
  tags: decisions.tags,
  linearIssueIds: decisions.linearIssueIds,
  author: decisions.author,
  createdAt: decisions.createdAt,
  committedAt: decisions.committedAt,
  chainPosition: decisions.chainPosition,
  entryHash: decisions.entryHash,
  projectSlug: projects.slug,
  projectName: projects.name,
  projectAccent: projects.accentColor,
} as const;

export async function listDecisionsByProjectSlug(projectSlug: string) {
  return db
    .select(DECISION_LIST_SELECT)
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
    .select(DECISION_LIST_SELECT)
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

function toContent(row: Decision): DecisionContent {
  return {
    projectId: row.projectId,
    title: row.title,
    rationale: row.rationale,
    tags: row.tags,
    linearIssueIds: row.linearIssueIds,
    author: row.author,
    createdAt: row.createdAt,
  };
}

/* Extend the chain for this decision's project and flip status to committed —
   atomically.

   Concurrency: a Postgres advisory transaction-scoped lock keyed on a stable
   hash of project_id serializes commits per project. Without it, two
   concurrent commits could read the same head and produce a fork.

   Returns null if the decision is missing or already committed. */
export async function commitDecision(id: string): Promise<{
  id: string;
  chainPosition: number;
  entryHash: Buffer;
} | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.status, "proposed")))
      .limit(1);
    if (!target) return null;

    // Serialize commits within the same project. `hashtextextended` maps
    // the UUID string to a stable bigint — perfect lock key.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${target.projectId}::text, 0))`,
    );

    const [head] = await tx
      .select({
        chainPosition: decisions.chainPosition,
        entryHash: decisions.entryHash,
      })
      .from(decisions)
      .where(
        and(
          eq(decisions.projectId, target.projectId),
          eq(decisions.status, "committed"),
          isNotNull(decisions.chainPosition),
          isNotNull(decisions.entryHash),
        ),
      )
      .orderBy(desc(decisions.chainPosition))
      .limit(1);

    const headRef: ChainHead =
      head && head.chainPosition !== null && head.entryHash
        ? { chainPosition: head.chainPosition, entryHash: head.entryHash }
        : null;

    const ext = computeExtension(headRef, toContent(target));

    const [updated] = await tx
      .update(decisions)
      .set({
        status: "committed",
        committedAt: new Date(),
        chainPosition: ext.chainPosition,
        contentHash: ext.contentHash,
        prevHash: ext.prevHash,
        entryHash: ext.entryHash,
      })
      .where(eq(decisions.id, id))
      .returning({
        id: decisions.id,
        chainPosition: decisions.chainPosition,
        entryHash: decisions.entryHash,
      });

    if (
      !updated ||
      updated.chainPosition === null ||
      updated.entryHash === null
    ) {
      throw new Error("Commit update returned no row");
    }

    return {
      id: updated.id,
      chainPosition: updated.chainPosition,
      entryHash: updated.entryHash,
    };
  });
}

/* List the chain — committed entries only, ordered by chain_position ASC —
   with every field the verifier needs. */
export async function listChainByProjectSlug(projectSlug: string) {
  return db
    .select({
      id: decisions.id,
      projectId: decisions.projectId,
      title: decisions.title,
      rationale: decisions.rationale,
      tags: decisions.tags,
      linearIssueIds: decisions.linearIssueIds,
      author: decisions.author,
      createdAt: decisions.createdAt,
      committedAt: decisions.committedAt,
      chainPosition: decisions.chainPosition,
      contentHash: decisions.contentHash,
      prevHash: decisions.prevHash,
      entryHash: decisions.entryHash,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(
      and(
        eq(projects.slug, projectSlug),
        eq(decisions.status, "committed"),
        isNotNull(decisions.chainPosition),
      ),
    )
    .orderBy(asc(decisions.chainPosition));
}
