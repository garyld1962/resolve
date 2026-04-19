import "server-only";
import { and, arrayOverlaps, eq, ne } from "drizzle-orm";
import { db } from "../client";
import { decisions, projects } from "../schema";

export const IMPACT_MIN_SHARED_TAGS = 2;

export type ImpactItem = {
  id: string;
  title: string;
  rationale: string;
  tags: string[];
  committedAt: Date | null;
  projectSlug: string;
  projectName: string;
  projectAccentColor: string;
  sharedTags: string[];
};

export type ImpactEndpoint = {
  id: string;
  title: string;
  tags: string[];
  projectSlug: string;
  projectName: string;
  projectAccentColor: string;
};

export type ImpactPair = {
  a: ImpactEndpoint;
  b: ImpactEndpoint;
  sharedTags: string[];
};

/* Cross-project decisions (committed) sharing >= IMPACT_MIN_SHARED_TAGS tags
   with the given decision. Sorted by shared-tag count desc, then committedAt
   desc. Returns [] if the source decision is missing or tagless. */
export async function getImpactRadius(
  decisionId: string,
): Promise<ImpactItem[]> {
  const [source] = await db
    .select({
      projectId: decisions.projectId,
      tags: decisions.tags,
    })
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1);

  if (!source || source.tags.length === 0) return [];

  // Postgres `&&` overlap operator narrows to candidates with >=1 shared tag.
  // Application code computes the actual shared-count (Postgres has no
  // single-expression way to count array intersection without an extension).
  const candidates = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
      tags: decisions.tags,
      committedAt: decisions.committedAt,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccentColor: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(
      and(
        ne(decisions.projectId, source.projectId),
        eq(decisions.status, "committed"),
        arrayOverlaps(decisions.tags, source.tags),
      ),
    );

  const sourceTagSet = new Set(source.tags);
  return candidates
    .map((c) => ({
      ...c,
      sharedTags: c.tags.filter((t) => sourceTagSet.has(t)),
    }))
    .filter((c) => c.sharedTags.length >= IMPACT_MIN_SHARED_TAGS)
    .sort((a, b) => {
      if (b.sharedTags.length !== a.sharedTags.length) {
        return b.sharedTags.length - a.sharedTags.length;
      }
      const aT = a.committedAt?.getTime() ?? 0;
      const bT = b.committedAt?.getTime() ?? 0;
      return bT - aT;
    });
}

/* All unique pairs of committed decisions across different projects sharing
   >= IMPACT_MIN_SHARED_TAGS tags. Sorted by shared count desc.

   v1: O(n^2) JS pass over all committed decisions. Acceptable while the
   committed-decision count is small (<10k). When this gets slow, push the
   intersection into Postgres via a recursive CTE or a materialized view. */
export async function getCrossProjectImpactPairs(): Promise<ImpactPair[]> {
  const rows = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      tags: decisions.tags,
      projectId: decisions.projectId,
      projectSlug: projects.slug,
      projectName: projects.name,
      projectAccentColor: projects.accentColor,
    })
    .from(decisions)
    .innerJoin(projects, eq(decisions.projectId, projects.id))
    .where(eq(decisions.status, "committed"));

  const pairs: ImpactPair[] = [];
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (a.tags.length === 0) continue;
    const aTagSet = new Set(a.tags);
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (a.projectId === b.projectId) continue;
      const sharedTags = b.tags.filter((t) => aTagSet.has(t));
      if (sharedTags.length < IMPACT_MIN_SHARED_TAGS) continue;
      pairs.push({
        a: {
          id: a.id,
          title: a.title,
          tags: a.tags,
          projectSlug: a.projectSlug,
          projectName: a.projectName,
          projectAccentColor: a.projectAccentColor,
        },
        b: {
          id: b.id,
          title: b.title,
          tags: b.tags,
          projectSlug: b.projectSlug,
          projectName: b.projectName,
          projectAccentColor: b.projectAccentColor,
        },
        sharedTags,
      });
    }
  }
  return pairs.sort((x, y) => y.sharedTags.length - x.sharedTags.length);
}
