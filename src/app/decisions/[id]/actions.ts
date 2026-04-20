"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { commitDecision } from "@/db/queries/decisions";
import { embedDecisionAfterCommit } from "@/db/queries/embeddings";

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
  // (Shared with MCP commit_decision; see embeddings.ts for rationale.)
  after(() => embedDecisionAfterCommit(id));
}
