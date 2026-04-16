import { describe, expect, it } from "vitest";
import {
  canonicalizeDecisionContent,
  type DecisionContent,
} from "./canonicalize";
import { computeExtension } from "./extend";
import { sha256, HASH_BYTES } from "./hash";
import { merkleRoot } from "./merkle";
import { verifyChain, type ChainEntry } from "./verify";

function contentAt(createdAt: string, overrides: Partial<DecisionContent> = {}): DecisionContent {
  return {
    projectId: "00000000-0000-0000-0000-000000000001",
    title: "Standardize on NATS JetStream",
    rationale: "Better fit than Redis pub/sub for our durability needs.",
    tags: ["messaging", "NATS"],
    linearIssueIds: ["RES-42"],
    author: "Gary",
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

/* Build a well-formed chain of `n` committed entries. */
function buildChain(n: number): ChainEntry[] {
  const entries: ChainEntry[] = [];
  let head: { chainPosition: number; entryHash: Buffer } | null = null;
  for (let i = 1; i <= n; i++) {
    const content = contentAt(`2026-04-01T00:00:${String(i).padStart(2, "0")}Z`, {
      title: `Decision ${i}`,
    });
    const ext = computeExtension(head, content);
    entries.push({
      content,
      chainPosition: ext.chainPosition,
      contentHash: ext.contentHash,
      prevHash: ext.prevHash,
      entryHash: ext.entryHash,
    });
    head = { chainPosition: ext.chainPosition, entryHash: ext.entryHash };
  }
  return entries;
}

describe("canonicalizeDecisionContent", () => {
  it("is order-invariant for tags and linearIssueIds", () => {
    const a = canonicalizeDecisionContent(
      contentAt("2026-04-01T00:00:00Z", {
        tags: ["NATS", "messaging"],
        linearIssueIds: ["RES-1", "RES-2"],
      }),
    );
    const b = canonicalizeDecisionContent(
      contentAt("2026-04-01T00:00:00Z", {
        tags: ["messaging", "NATS"],
        linearIssueIds: ["RES-2", "RES-1"],
      }),
    );
    expect(a.equals(b)).toBe(true);
  });

  it("produces different bytes when any content field changes", () => {
    const base = canonicalizeDecisionContent(contentAt("2026-04-01T00:00:00Z"));
    const changes: Array<Partial<DecisionContent>> = [
      { title: "Different title" },
      { rationale: "Different rationale" },
      { author: "Someone else" },
      { tags: ["messaging"] },
      { linearIssueIds: [] },
      { createdAt: new Date("2026-04-01T00:00:01Z") },
    ];
    for (const c of changes) {
      const variant = canonicalizeDecisionContent(
        contentAt("2026-04-01T00:00:00Z", c),
      );
      expect(base.equals(variant)).toBe(false);
    }
  });
});

describe("computeExtension", () => {
  it("produces a 32-byte entry_hash starting at position 1 for genesis", () => {
    const ext = computeExtension(null, contentAt("2026-04-01T00:00:00Z"));
    expect(ext.chainPosition).toBe(1);
    expect(ext.entryHash.length).toBe(HASH_BYTES);
    expect(ext.prevHash.equals(Buffer.alloc(HASH_BYTES, 0))).toBe(true);
  });

  it("links prev_hash to the previous entry's entry_hash", () => {
    const first = computeExtension(null, contentAt("2026-04-01T00:00:00Z"));
    const second = computeExtension(
      { chainPosition: first.chainPosition, entryHash: first.entryHash },
      contentAt("2026-04-01T00:00:01Z", { title: "Second" }),
    );
    expect(second.chainPosition).toBe(2);
    expect(second.prevHash.equals(first.entryHash)).toBe(true);
  });

  it("entry_hash depends on chain position (same content at different positions → different hash)", () => {
    const content = contentAt("2026-04-01T00:00:00Z");
    const atOne = computeExtension(null, content);
    const atTwo = computeExtension(
      { chainPosition: 1, entryHash: sha256(Buffer.from("something else")) },
      content,
    );
    expect(atOne.entryHash.equals(atTwo.entryHash)).toBe(false);
  });
});

describe("verifyChain", () => {
  it("returns ok for a valid chain of length 0", () => {
    const result = verifyChain([]);
    expect(result).toEqual({ ok: true, length: 0 });
  });

  it("returns ok for a valid chain of length 5", () => {
    const chain = buildChain(5);
    const result = verifyChain(chain);
    expect(result).toEqual({ ok: true, length: 5 });
  });

  /* This is the M2 exit-criterion assertion: verify must detect tampering. */
  it("detects a mutated title at position 3 (content_hash_mismatch)", () => {
    const chain = buildChain(5);
    const tampered: ChainEntry[] = [...chain];
    tampered[2] = {
      ...chain[2],
      content: { ...chain[2].content, title: "MUTATED" },
    };
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breakAt).toBe(3);
      expect(result.reason).toBe("content_hash_mismatch");
    }
  });

  it("detects a mutated rationale at position 1 (genesis tampering)", () => {
    const chain = buildChain(3);
    const tampered: ChainEntry[] = [...chain];
    tampered[0] = {
      ...chain[0],
      content: { ...chain[0].content, rationale: "MUTATED" },
    };
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breakAt).toBe(1);
      expect(result.reason).toBe("content_hash_mismatch");
    }
  });

  it("detects a tampered prev_hash (forged linkage)", () => {
    const chain = buildChain(4);
    const tampered: ChainEntry[] = [...chain];
    tampered[2] = {
      ...chain[2],
      prevHash: sha256(Buffer.from("forged")),
    };
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breakAt).toBe(3);
      expect(result.reason).toBe("prev_hash_mismatch");
    }
  });

  it("detects a tampered entry_hash even when content is untouched", () => {
    const chain = buildChain(3);
    const tampered: ChainEntry[] = [...chain];
    tampered[1] = { ...chain[1], entryHash: sha256(Buffer.from("forged")) };
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breakAt).toBe(2);
      expect(result.reason).toBe("entry_hash_mismatch");
    }
  });

  it("detects a position gap (skipped chain position)", () => {
    const chain = buildChain(3);
    // Splice out position 2.
    const result = verifyChain([chain[0], chain[2]]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breakAt).toBe(3);
      expect(result.reason).toBe("position_gap");
    }
  });
});

describe("merkleRoot", () => {
  it("returns zero hash for empty input", () => {
    expect(merkleRoot([]).equals(Buffer.alloc(HASH_BYTES, 0))).toBe(true);
  });

  it("returns the single leaf unchanged for length 1", () => {
    const leaf = sha256(Buffer.from("alone"));
    expect(merkleRoot([leaf]).equals(leaf)).toBe(true);
  });

  it("produces the same root for the same inputs", () => {
    const leaves = [1, 2, 3, 4, 5].map((i) =>
      sha256(Buffer.from(`leaf-${i}`)),
    );
    expect(merkleRoot(leaves).equals(merkleRoot(leaves))).toBe(true);
  });

  it("root changes if any leaf changes", () => {
    const leaves = [1, 2, 3, 4, 5].map((i) =>
      sha256(Buffer.from(`leaf-${i}`)),
    );
    const original = merkleRoot(leaves);
    leaves[2] = sha256(Buffer.from("tampered"));
    expect(merkleRoot(leaves).equals(original)).toBe(false);
  });

  it("root is stable across odd-length inputs (last leaf duplicated)", () => {
    const leaves = [1, 2, 3].map((i) => sha256(Buffer.from(`leaf-${i}`)));
    // A deterministic value — we're locking in behavior, not computing by hand.
    const root = merkleRoot(leaves);
    expect(root.length).toBe(HASH_BYTES);
    // Same input → same root.
    expect(merkleRoot(leaves).equals(root)).toBe(true);
  });
});
