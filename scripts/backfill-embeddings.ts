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
  while (true) {
    const rows = await listDecisionsMissingEmbedding(BATCH);
    if (rows.length === 0) break;

    const texts = rows.map((r) => decisionEmbedText(r));
    const vectors = await embed(texts, "document");

    for (let i = 0; i < rows.length; i++) {
      await setDecisionEmbedding(rows[i].id, vectors[i]);
    }
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
