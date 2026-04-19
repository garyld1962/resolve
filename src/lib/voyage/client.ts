import "server-only";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";
const DIMENSIONS = 1024;
const TIMEOUT_MS = 15_000;

export type VoyageInputType = "document" | "query";

type VoyageResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
};

/* Lazy: read env at call time, not module load — Next.js evaluates this module
   during build before runtime env is injected. Mirrors src/db/client.ts. */
function requireKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY is not set. Run `vercel env pull .env.local` or set it in the environment.",
    );
  }
  return key;
}

/* Returns embeddings in the same order as `texts`. The Voyage API may return
   results out of order — we re-sort by `index`. */
export async function embed(
  texts: string[],
  inputType: VoyageInputType,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requireKey()}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts, input_type: inputType }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embed failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as VoyageResponse;
  const ordered = [...json.data].sort((a, b) => a.index - b.index);

  for (const row of ordered) {
    if (row.embedding.length !== DIMENSIONS) {
      throw new Error(
        `Voyage returned dimension ${row.embedding.length}, expected ${DIMENSIONS}`,
      );
    }
  }
  return ordered.map((r) => r.embedding);
}

export const VOYAGE_DIMENSIONS = DIMENSIONS;
export const VOYAGE_MODEL = MODEL;
