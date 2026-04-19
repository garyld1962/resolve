import "dotenv/config";
import { config } from "dotenv";
import {
  decisionEmbedText,
  listDecisionsMissingEmbedding,
  setDecisionEmbedding,
} from "@/db/queries/embeddings";
import { embed } from "@/lib/voyage";

config({ path: ".env.local" });

const BATCH = 16;

async function main() {
  let total = 0;
  let lastBatchIds: string | null = null;

  while (true) {
    const rows = await listDecisionsMissingEmbedding(BATCH);
    if (rows.length === 0) break;

    // Bail if the same batch reappears — implies setDecisionEmbedding isn't
    // clearing the IS NULL predicate (driver bug, schema constraint, etc.).
    // Without this guard the loop would burn Voyage tokens forever.
    const batchKey = rows.map((r) => r.id).join(",");
    if (batchKey === lastBatchIds) {
      throw new Error(
        `Backfill loop guard: same ${rows.length} decisions returned twice in a row — embeddings are not persisting. First id: ${rows[0].id}`,
      );
    }
    lastBatchIds = batchKey;

    const texts = rows.map((r) => decisionEmbedText(r));
    const vectors = await embed(texts, "document");
    if (vectors.length !== rows.length) {
      throw new Error(
        `Voyage returned ${vectors.length} vectors for ${rows.length} inputs`,
      );
    }

    // Updates target distinct PKs — safe to parallelize.
    await Promise.all(
      rows.map((row, i) => setDecisionEmbedding(row.id, vectors[i])),
    );
    total += rows.length;
    console.log(`✓ embedded ${rows.length} (running total: ${total})`);
  }
  console.log(`done — ${total} embeddings backfilled`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
