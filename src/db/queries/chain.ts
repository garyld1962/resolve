import "server-only";
import {
  merkleRoot,
  verifyChain,
  type ChainEntry,
  type VerifyResult,
} from "@/lib/chain";
import { listChainByProjectSlug } from "./decisions";

export type ChainSummary = {
  length: number;
  head: {
    chainPosition: number;
    entryHash: Buffer;
    committedAt: Date;
    title: string;
    decisionId: string;
  } | null;
  merkleRoot: Buffer;
  verify: VerifyResult;
};

export async function getChainSummary(
  projectSlug: string,
): Promise<ChainSummary> {
  const rows = await listChainByProjectSlug(projectSlug);

  const entries: ChainEntry[] = rows
    .filter(
      (r): r is typeof r & {
        chainPosition: number;
        contentHash: Buffer;
        prevHash: Buffer;
        entryHash: Buffer;
      } =>
        r.chainPosition !== null &&
        r.contentHash !== null &&
        r.prevHash !== null &&
        r.entryHash !== null,
    )
    .map((r) => ({
      content: {
        projectId: r.projectId,
        title: r.title,
        rationale: r.rationale,
        tags: r.tags,
        linearIssueIds: r.linearIssueIds,
        author: r.author,
        createdAt: r.createdAt,
      },
      chainPosition: r.chainPosition,
      contentHash: r.contentHash,
      prevHash: r.prevHash,
      entryHash: r.entryHash,
    }));

  const lastRow = rows[rows.length - 1];
  const head =
    lastRow && lastRow.chainPosition !== null && lastRow.entryHash && lastRow.committedAt
      ? {
          chainPosition: lastRow.chainPosition,
          entryHash: lastRow.entryHash,
          committedAt: lastRow.committedAt,
          title: lastRow.title,
          decisionId: lastRow.id,
        }
      : null;

  return {
    length: entries.length,
    head,
    merkleRoot: merkleRoot(entries.map((e) => e.entryHash)),
    verify: verifyChain(entries),
  };
}
