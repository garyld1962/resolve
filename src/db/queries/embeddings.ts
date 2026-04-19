import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { decisions } from "../schema";

/* Persist the embedding for one decision. Idempotent — overwrite is fine. */
export async function setDecisionEmbedding(
  id: string,
  vector: number[],
): Promise<void> {
  await db
    .update(decisions)
    .set({ embedding: vector })
    .where(eq(decisions.id, id));
}

/* IDs of committed decisions that don't yet have an embedding.
   Used by the backfill script and by retry logic. */
export async function listDecisionsMissingEmbedding(
  limit = 100,
): Promise<Array<{ id: string; title: string; rationale: string }>> {
  return db
    .select({
      id: decisions.id,
      title: decisions.title,
      rationale: decisions.rationale,
    })
    .from(decisions)
    .where(
      and(eq(decisions.status, "committed"), isNull(decisions.embedding)),
    )
    .orderBy(decisions.createdAt)
    .limit(limit);
}

/* Build the text we embed. Centralized so backfill and embed-on-commit agree.
   "title\n\nrationale" — title gets retrieval weight, rationale is the body. */
export function decisionEmbedText(input: {
  title: string;
  rationale: string;
}): string {
  return `${input.title}\n\n${input.rationale}`;
}
