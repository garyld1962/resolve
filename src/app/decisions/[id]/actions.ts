"use server";

import { revalidatePath } from "next/cache";
import { commitDecision } from "@/db/queries/decisions";

export async function commitDecisionAction(id: string): Promise<void> {
  const row = await commitDecision(id);
  if (!row) {
    // Already committed or missing — caller's UI revalidates either way.
    return;
  }
  revalidatePath("/");
  revalidatePath(`/decisions/${id}`);
}
