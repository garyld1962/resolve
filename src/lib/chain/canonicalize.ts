/* Content-bearing view of a decision. Only fields a user authored belong here —
   NOT: id (surrogate key), status, committedAt, or any chain field. */
export type DecisionContent = {
  projectId: string;
  title: string;
  rationale: string;
  tags: readonly string[];
  linearIssueIds: readonly string[];
  author: string;
  createdAt: Date;
};

/* Deterministic JSON serialization: keys sorted ascending, arrays sorted for
   order-invariant fields (tags, linearIssueIds), createdAt coerced to an
   ISO 8601 UTC string with ms precision. No whitespace.

   The output is the pre-image of content_hash. Any tweak to this function
   invalidates every historical hash, so treat it like a wire format: additive
   changes only (new fields appended at the bottom when a schema migration
   adds them post-genesis). */
export function canonicalizeDecisionContent(
  content: DecisionContent,
): Buffer {
  const canonical = {
    author: content.author,
    createdAt: content.createdAt.toISOString(),
    linearIssueIds: [...content.linearIssueIds].sort(),
    projectId: content.projectId,
    rationale: content.rationale,
    tags: [...content.tags].sort(),
    title: content.title,
  };
  return Buffer.from(JSON.stringify(canonical), "utf8");
}
