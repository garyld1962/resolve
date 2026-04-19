import Link from "next/link";
import { sql } from "drizzle-orm";
import { SearchForm } from "./search-form";
import { searchDecisions, type SearchResult } from "@/db/queries/search";
import { embed } from "@/lib/voyage";
import { db } from "@/db/client";
import { decisions } from "@/db/schema";
import type { DecisionStatus } from "@/db/schema/decisions";

export const dynamic = "force-dynamic";

const VALID_STATUSES: DecisionStatus[] = ["proposed", "committed"];

async function loadKnownTags(): Promise<string[]> {
  const rows = await db
    .select({ tag: sql<string>`unnest(${decisions.tags})` })
    .from(decisions);
  const set = new Set<string>();
  for (const r of rows) if (r.tag) set.add(r.tag);
  return [...set].sort();
}

async function runSearch(
  q: string,
  tags: string[],
  status: DecisionStatus | undefined,
): Promise<SearchResult[]> {
  const [queryVector] = await embed([q], "query");
  return searchDecisions({
    queryVector,
    tags: tags.length > 0 ? tags : undefined,
    status,
    limit: 20,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tags = Array.isArray(sp.tag)
    ? sp.tag
    : typeof sp.tag === "string"
      ? [sp.tag]
      : [];
  const statusRaw = typeof sp.status === "string" ? sp.status : "";
  const status = (VALID_STATUSES as string[]).includes(statusRaw)
    ? (statusRaw as DecisionStatus)
    : undefined;

  const [knownTags, results] = await Promise.all([
    loadKnownTags(),
    q ? runSearch(q, tags, status) : Promise.resolve<SearchResult[]>([]),
  ]);

  return (
    <main className="flex flex-1 flex-col w-full max-w-[1200px] mx-auto px-8 py-12 gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          resolve · semantic search
        </p>
        <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-cloud-white">
          Search decisions
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-silver-mist">
          Powered by Voyage embeddings. Filter by tag and status. Only committed
          decisions with embeddings appear in results.
        </p>
      </header>

      <SearchForm knownTags={knownTags} />

      {q ? (
        results.length === 0 ? (
          <p className="text-sm text-silver-mist">
            No matches for <span className="font-mono">&ldquo;{q}&rdquo;</span>.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {results.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-5"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Link
                    href={`/decisions/${r.id}`}
                    className="text-base font-medium text-cloud-white hover:text-reasoning-indigo"
                  >
                    {r.title}
                  </Link>
                  <span
                    className="font-mono text-xs text-reasoning-indigo"
                    title="Cosine similarity"
                  >
                    {r.similarity.toFixed(3)}
                  </span>
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-silver-mist">
                  {r.rationale}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {r.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-frost-line px-2 py-0.5 font-mono text-zinc-whisper"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )
      ) : (
        <p className="text-sm text-zinc-whisper">
          Enter a query to search across all committed decisions.
        </p>
      )}
    </main>
  );
}
