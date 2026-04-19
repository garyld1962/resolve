import "server-only";
import { z } from "zod";
import { createDecision } from "@/db/queries/decisions";
import {
  LinearIssuesSchema,
  ProjectSlugSchema,
  TagsSchema,
  TitleSchema,
} from "../schemas";
import { ToolError, wrapTool } from "../wrap-tool";

const InputSchema = z
  .object({
    project: ProjectSlugSchema,
    title: TitleSchema,
    rationale: z.string(),
    tags: TagsSchema,
    linear_issues: LinearIssuesSchema,
    author: z.string().min(1),
  })
  .strict();

export type RecordDecisionInput = z.input<typeof InputSchema>;

export const recordDecisionTool = {
  name: "record_decision" as const,
  description:
    "Record a new decision in Resolve with status=proposed. Agents must call commit_decision separately to chain it.",
  inputSchema: InputSchema,
  handler: wrapTool(async (raw: RecordDecisionInput) => {
    const input = InputSchema.parse(raw);
    try {
      const { id } = await createDecision({
        projectSlug: input.project,
        title: input.title,
        rationale: input.rationale,
        tags: input.tags,
        linearIssueIds: input.linear_issues,
        author: input.author,
      });
      return { id, status: "proposed" as const };
    } catch (err) {
      if (err instanceof Error && /Unknown project slug/i.test(err.message)) {
        throw new ToolError("UNKNOWN_PROJECT", err.message);
      }
      throw err;
    }
  }),
};
