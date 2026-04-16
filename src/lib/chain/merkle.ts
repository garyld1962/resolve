import { sha256Concat, ZERO_HASH } from "./hash";

/* Standard Bitcoin-style binary Merkle tree over an ordered list of leaf
   hashes. Odd levels duplicate the last node to pair (matches PRD §5.3
   "Merkle root is computed ... over all committed entries"). */
export function merkleRoot(leaves: readonly Buffer[]): Buffer {
  if (leaves.length === 0) return ZERO_HASH;
  if (leaves.length === 1) return leaves[0];

  let level: Buffer[] = [...leaves];
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256Concat(left, right));
    }
    level = next;
  }
  return level[0];
}
