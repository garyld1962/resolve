import "server-only";
import { z } from "zod";
import {
  getImpactRadius,
  IMPACT_MIN_SHARED_TAGS,
} from "@/db/queries/impact";
import { getDecisionById } from "@/db/queries/decisions";
import { UuidSchema } from "../schemas";
import { ToolError, wrapTool } from "../wrap-tool";

const InputSchema = z
  .object({
    decision_id: UuidSchema,
    min_shared_tags: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type GetImpactRadiusInput = z.input<typeof InputSchema>;

export const getImpactRadiusTool = {
  name: "get_impact_radius" as const,
  description:
    "Cross-project impact radius for a decision: other projects' decisions sharing ≥N tags (default 2). `min_shared_tags` raises the threshold via client-side filtering.",
  inputSchema: InputSchema,
  handler: wrapTool(async (raw: GetImpactRadiusInput) => {
    const input = InputSchema.parse(raw);
    const existing = await getDecisionById(input.decision_id);
    if (!existing)
      throw new ToolError("NOT_FOUND", `No decision ${input.decision_id}`);

    const allItems = await getImpactRadius(input.decision_id);
    const threshold = input.min_shared_tags ?? IMPACT_MIN_SHARED_TAGS;
    // DB layer returns items with shared_tags.length >= IMPACT_MIN_SHARED_TAGS.
    // Client-side filter can only tighten (raise the threshold); lowering it
    // would require widening the DB query — not supported in v1.
    const items = allItems.filter(
      (i) => i.sharedTags.length >= threshold,
    );

    return {
      decision_id: input.decision_id,
      impact: items.map((i) => ({
        id: i.id,
        title: i.title,
        project_slug: i.projectSlug,
        project_name: i.projectName,
        shared_tags: i.sharedTags,
        shared_tag_count: i.sharedTags.length,
      })),
    };
  }),
};
