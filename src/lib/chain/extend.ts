import {
  canonicalizeDecisionContent,
  type DecisionContent,
} from "./canonicalize";
import {
  chainPositionBytes,
  sha256,
  sha256Concat,
  ZERO_HASH,
} from "./hash";

export type ChainHead = {
  chainPosition: number;
  entryHash: Buffer;
} | null; // null = genesis (no entries yet for this project)

export type ExtensionResult = {
  chainPosition: number;
  contentHash: Buffer;
  prevHash: Buffer;
  entryHash: Buffer;
};

/* Computes the next chain entry's hashes given the current head and new content.
   Pure function — suitable for unit tests and for reuse by the verify walker. */
export function computeExtension(
  head: ChainHead,
  content: DecisionContent,
): ExtensionResult {
  const chainPosition = (head?.chainPosition ?? 0) + 1;
  const prevHash = head?.entryHash ?? ZERO_HASH;
  const contentHash = sha256(canonicalizeDecisionContent(content));
  const entryHash = sha256Concat(
    contentHash,
    prevHash,
    chainPositionBytes(chainPosition),
  );
  return { chainPosition, contentHash, prevHash, entryHash };
}
