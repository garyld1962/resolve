import "server-only";
import { z } from "zod";
import { getChainSummary } from "@/db/queries/chain";
import { getProjectIdBySlug } from "@/db/queries/decisions";
import { listProjects } from "@/db/queries/projects";
import { ProjectSlugSchema } from "../schemas";
import { ToolError, wrapTool } from "../wrap-tool";

const InputSchema = z
  .object({
    project: ProjectSlugSchema.optional(),
  })
  .strict();

export type VerifyChainInput = z.input<typeof InputSchema>;

type Result = {
  project_slug: string;
  verified: boolean;
  chain_length: number;
  merkle_root: string;
  break_at: number | null;
  error: string | null;
};

async function verifyOne(slug: string): Promise<Result> {
  try {
    const summary = await getChainSummary(slug);
    return {
      project_slug: slug,
      verified: summary.verify.ok,
      chain_length: summary.length,
      merkle_root: summary.merkleRoot.toString("hex"),
      break_at: summary.verify.ok ? null : summary.verify.breakAt,
      error: null,
    };
  } catch (err) {
    return {
      project_slug: slug,
      verified: false,
      chain_length: 0,
      merkle_root: "",
      break_at: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const verifyChainTool = {
  name: "verify_chain" as const,
  description:
    "Recompute + verify the SHA-256 chain for one project (by slug) or all projects (if omitted). Returns per-project verification results.",
  inputSchema: InputSchema,
  handler: wrapTool(async (raw: VerifyChainInput) => {
    const input = InputSchema.parse(raw);

    if (input.project) {
      const id = await getProjectIdBySlug(input.project);
      if (!id) throw new ToolError("UNKNOWN_PROJECT", input.project);
      return { results: [await verifyOne(input.project)] };
    }

    const all = await listProjects();
    const results: Result[] = [];
    for (const p of all) results.push(await verifyOne(p.slug));
    return { results };
  }),
};
