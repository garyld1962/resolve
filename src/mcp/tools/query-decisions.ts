import "server-only";
import { z } from "zod";
import { listDecisionsFiltered } from "@/db/queries/decisions";
import { searchDecisions } from "@/db/queries/search";
import { embed } from "@/lib/voyage";
import {
  IsoDateSchema,
  LimitSchema,
  ProjectSlugSchema,
  StatusSchema,
  TagsSchema,
} from "../schemas";
import { ToolError, wrapTool } from "../wrap-tool";

const InputSchema = z
  .object({
    query: z.string().min(1).optional(),
    project: ProjectSlugSchema.optional(),
    tags: TagsSchema.optional(),
    status: StatusSchema.optional(),
    limit: LimitSchema.optional(),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
  })
  .strict();

export type QueryDecisionsInput = z.input<typeof InputSchema>;

type Item = {
  id: string;
  title: string;
  rationale: string;
  tags: string[];
  author: string;
  committed_at: string | null;
  chain_position: number | null;
  project_slug: string;
  project_name: string;
  similarity: number | null;
};

export const queryDecisionsTool = {
  name: "query_decisions" as const,
  description:
    "Query decisions. Optional `query` triggers semantic similarity search (Voyage embed + pgvector cosine). Omit `query` for pure filter mode (no embedding cost).",
  inputSchema: InputSchema,
  handler: wrapTool(async (raw: QueryDecisionsInput) => {
    const input = InputSchema.parse(raw);

    if (input.query) {
      // Semantic path. Voyage failures → retryable EMBEDDING_FAILED.
      let vec: number[];
      try {
        const [firstVec] = await embed([input.query], "query");
        vec = firstVec;
      } catch (err) {
        throw new ToolError(
          "EMBEDDING_FAILED",
          err instanceof Error ? err.message : "Voyage embed failed",
          { retryable: true },
        );
      }
      const rows = await searchDecisions({
        queryVector: vec,
        projectSlug: input.project,
        status: input.status,
        tags: input.tags,
        from: input.from,
        to: input.to,
        limit: input.limit,
      });
      return {
        items: rows.map(
          (r): Item => ({
            id: r.id,
            title: r.title,
            rationale: r.rationale,
            tags: r.tags,
            author: r.author,
            committed_at: r.committedAt?.toISOString() ?? null,
            chain_position: r.chainPosition,
            project_slug: r.projectSlug,
            project_name: r.projectName,
            similarity: r.similarity,
          }),
        ),
      };
    }

    // Filter-only path. No Voyage call.
    const rows = await listDecisionsFiltered({
      projectSlug: input.project,
      status: input.status,
      tags: input.tags,
      from: input.from,
      to: input.to,
      limit: input.limit,
    });
    return {
      items: rows.map(
        (r): Item => ({
          id: r.id,
          title: r.title,
          rationale: r.rationale,
          tags: r.tags,
          author: r.author,
          committed_at: r.committedAt?.toISOString() ?? null,
          chain_position: r.chainPosition,
          project_slug: r.projectSlug,
          project_name: r.projectName,
          similarity: null,
        }),
      ),
    };
  }),
};
