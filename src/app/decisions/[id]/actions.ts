"use server";

import { revalidatePath } from "next/cache";
import { commitDecision, getDecisionById } from "@/db/queries/decisions";
import {
  decisionEmbedText,
  setDecisionEmbedding,
} from "@/db/queries/embeddings";
import { embed } from "@/lib/voyage";

/* Embedding runs OUTSIDE the chain transaction. Holding the per-project
   advisory lock across a network call to Voyage would serialize all commits
   behind embedding latency. Failures are tolerated — a backfill script
   reconciles missing embeddings. */
async function embedAfterCommit(id: string): Promise<void> {
  try {
    const row = await getDecisionById(id);
    if (!row) return;
    const [vector] = await embed(
      [decisionEmbedText({ title: row.title, rationale: row.rationale })],
      "document",
    );
    await setDecisionEmbedding(id, vector);
  } catch (err) {
    // Log and swallow — chain commit already succeeded; backfill will retry.
    console.error(`[M3] embed-after-commit failed for ${id}:`, err);
  }
}

export async function commitDecisionAction(id: string): Promise<void> {
  const row = await commitDecision(id);
  if (!row) {
    // Already committed or missing — caller's UI revalidates either way.
    return;
  }
  await embedAfterCommit(id);
  revalidatePath("/");
  revalidatePath(`/decisions/${id}`);
  revalidatePath("/search");
}
