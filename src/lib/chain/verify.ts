import { computeExtension, type ChainHead } from "./extend";
import type { DecisionContent } from "./canonicalize";

/* A ChainEntry is the server-persisted view of a committed decision. */
export type ChainEntry = {
  content: DecisionContent;
  chainPosition: number;
  contentHash: Buffer;
  prevHash: Buffer;
  entryHash: Buffer;
};

export type VerifyOk = { ok: true; length: number };
export type VerifyBroken = {
  ok: false;
  length: number;
  breakAt: number; // chainPosition of the first entry that fails
  reason:
    | "content_hash_mismatch"
    | "prev_hash_mismatch"
    | "entry_hash_mismatch"
    | "position_gap";
};
export type VerifyResult = VerifyOk | VerifyBroken;

function equalBuffers(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.equals(b);
}

/* Walks committed entries (ordered by chain_position ASC) and recomputes each
   hash. Returns `{ok:true}` or `{ok:false, breakAt}` with the first failing
   position and a reason code.

   This is the test-facing fulcrum of M2. Mutating any persisted field that
   contributes to canonicalization (title, rationale, tags, ...) will flip a
   subsequent entry to `entry_hash_mismatch` or `content_hash_mismatch`. */
export function verifyChain(entries: readonly ChainEntry[]): VerifyResult {
  let head: ChainHead = null;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const expectedPos: number = (head?.chainPosition ?? 0) + 1;

    if (e.chainPosition !== expectedPos) {
      return {
        ok: false,
        length: entries.length,
        breakAt: e.chainPosition,
        reason: "position_gap",
      };
    }

    const computed = computeExtension(head, e.content);

    if (!equalBuffers(computed.contentHash, e.contentHash)) {
      return {
        ok: false,
        length: entries.length,
        breakAt: e.chainPosition,
        reason: "content_hash_mismatch",
      };
    }
    if (!equalBuffers(computed.prevHash, e.prevHash)) {
      return {
        ok: false,
        length: entries.length,
        breakAt: e.chainPosition,
        reason: "prev_hash_mismatch",
      };
    }
    if (!equalBuffers(computed.entryHash, e.entryHash)) {
      return {
        ok: false,
        length: entries.length,
        breakAt: e.chainPosition,
        reason: "entry_hash_mismatch",
      };
    }

    head = {
      chainPosition: e.chainPosition,
      entryHash: e.entryHash,
    };
  }

  return { ok: true, length: entries.length };
}
