import "server-only";
import { and, arrayContains, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { decisions, projects, type DecisionStatus } from "../schema";

export type SearchFilters = {
  queryVector: number[];
  projectSlug?: string;
  status?: DecisionStatus;
  /* All tags must be present (array contains semantics, NOT overlap). */
  tags?: string[];
  from?: Date;
  to?: Date;
  limit?: number;
};

export type SearchResult = {
  id: string;
  title: string;
  rationale: string;
  tags: string[];
  author: string;
  committedAt: Date | null;
  chainPosition: number | null;
  projectSlug: string;
  projectName: string;
  similarity: number; // 1 - cosine_distance, higher is better
};

const DEFAULT_LIMIT = 20;

/* Postgres pgvector requires a literal-formatted vector for the `<=>` operator.
   We bind it as a string and cast to vector to avoid pg-driver array bloat. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function searchDecisions(
  filters: SearchFilters,
): Promise<SearchResult[]> {
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const qLit = toVectorLiteral(filters.queryVector);
  const distance = sql<number>`${decisions.embedding} <=> ${qLit}::vector`;

  const conditions = [sql`${decisions.embedding} IS NOT NULL`];
  if (filters.projectSlug)
    conditions.push(eq(projects.slug, filters.projectSlug));
  if (filters.status) conditions.push(eq(decisions.status, filters.status));
  if (filters.tags && filters.tags.length > 0) {
    // arrayContains compiles to text[] @> text[] (row tags must include all).
    conditions.push(arrayContains(decisions.tags, filters.tags));
  }
  if (filters.from) conditions.push(gte(decisions.committedAt, filters.from));
  if (filters.to) conditions.push(lte(decisions.committedAt, filters.to));

  const rows = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
      tags: decisions.tags,
      author: decisions.author,
      committedAt: decisions.committedAt,
      chainPosition: decisions.chainPosition,
      projectSlug: projects.slug,
      projectName: projects.name,
      distance,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(distance)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    rationale: r.rationale,
    tags: r.tags,
    author: r.author,
    committedAt: r.committedAt,
    chainPosition: r.chainPosition,
    projectSlug: r.projectSlug,
    projectName: r.projectName,
    similarity: 1 - Number(r.distance),
  }));
}
