"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { commitDecision, getDecisionById } from "@/db/queries/decisions";
import {
  decisionEmbedText,
  setDecisionEmbedding,
} from "@/db/queries/embeddings";
import { embed } from "@/lib/voyage";

/* Embedding runs OUTSIDE the chain transaction AND outside the response path.
   - Outside the tx: holding the per-project advisory lock across a network
     call to Voyage would serialize all commits behind embedding latency.
   - Outside the response (via `after`): the user sees commit confirmation
     immediately; the embed completes in the background. On Vercel, `after`
     uses waitUntil so the function instance stays alive until the embed
     resolves. Failures are logged and swallowed — the chain commit already
     succeeded, the row stays NULL, and the backfill script reconciles. */
async function embedAfterCommit(id: string): Promise<void> {
  try {
    const row = await getDecisionById(id);
    if (!row) return;
    const [vector] = await embed(
      [decisionEmbedText({ title: row.title, rationale: row.rationale })],
      "document",
    );
    await setDecisionEmbedding(id, vector);
    // The embed landed after the initial response was sent — invalidate /search
    // so the next visit sees the new entry. Other paths were already
    // revalidated synchronously below.
    revalidatePath("/search");
  } catch (err) {
    console.error(`[M3] embed-after-commit failed for ${id}:`, err);
  }
}

export async function commitDecisionAction(id: string): Promise<void> {
  const row = await commitDecision(id);
  if (!row) {
    // Already committed or missing — caller's UI revalidates either way.
    return;
  }
  // Reflect the chain change immediately on user-facing pages.
  revalidatePath("/");
  revalidatePath(`/decisions/${id}`);
  // Run the embed after the response is sent.
  after(() => embedAfterCommit(id));
}
