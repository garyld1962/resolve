import "server-only";
import { after } from "next/server";
import { z } from "zod";
import {
  commitDecision,
  getDecisionById,
} from "@/db/queries/decisions";
import { embedDecisionAfterCommit } from "@/db/queries/embeddings";
import { UuidSchema } from "../schemas";
import { ToolError, wrapTool } from "../wrap-tool";

const InputSchema = z.object({ id: UuidSchema }).strict();
export type CommitDecisionInput = z.input<typeof InputSchema>;

export const commitDecisionTool = {
  name: "commit_decision" as const,
  description:
    "Commit a proposed decision — extends the SHA-256 chain and schedules the embedding backfill.",
  inputSchema: InputSchema,
  handler: wrapTool(async (raw: CommitDecisionInput) => {
    let input: z.output<typeof InputSchema>;
    try {
      input = InputSchema.parse(raw);
    } catch {
      throw new ToolError("NOT_FOUND", `No decision ${(raw as { id?: string }).id ?? "unknown"}`);
    }
    const result = await commitDecision(input.id);
    if (!result) {
      // commitDecision returns null when: id doesn't exist OR status !== 'proposed'.
      // Distinguish via a lookup — one extra roundtrip only on the error path.
      const existing = await getDecisionById(input.id);
      if (!existing) throw new ToolError("NOT_FOUND", `No decision ${input.id}`);
      if (existing.status === "committed") {
        throw new ToolError(
          "ALREADY_COMMITTED",
          `Decision ${input.id} is already committed`,
        );
      }
      throw new ToolError(
        "INVALID_STATE",
        `Decision ${input.id} has status ${existing.status}; cannot commit`,
      );
    }

    // Schedule embed-on-commit outside the response path (HANDOFF load-bearing
    // constraint #2). Shared helper lives in @/db/queries/embeddings.
    after(() => embedDecisionAfterCommit(result.id));

    return {
      id: result.id,
      chain_position: result.chainPosition,
      entry_hash: result.entryHash.toString("hex"),
      committed_at: new Date().toISOString(),
    };
  }),
};
