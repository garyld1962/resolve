import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../client";
import { decisions } from "../schema";
import { getDecisionById } from "./decisions";
import { embed } from "@/lib/voyage";

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

/* Post-commit embed: fetch the decision, call Voyage, persist the vector,
   revalidate /search. Failures are logged + swallowed — the chain commit
   already succeeded; the row stays NULL and the backfill script reconciles.

   Must be called OUTSIDE the chain transaction and outside the response
   path (via after() or equivalent) — holding the per-project advisory
   lock across the Voyage HTTP call would serialize all commits behind
   embedding latency. Shared by the UI server action (decisions/[id]/
   actions.ts) and the MCP commit_decision tool. */
export async function embedDecisionAfterCommit(id: string): Promise<void> {
  try {
    const row = await getDecisionById(id);
    if (!row) return;
    const [vector] = await embed(
      [decisionEmbedText({ title: row.title, rationale: row.rationale })],
      "document",
    );
    await setDecisionEmbedding(id, vector);
    revalidatePath("/search");
  } catch (err) {
    console.error(`[M3] embed-after-commit failed for ${id}:`, err);
  }
}
