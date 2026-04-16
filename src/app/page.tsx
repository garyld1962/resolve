import Link from "next/link";
import { DecisionCard } from "@/components/decision-card";
import { getChainSummary } from "@/db/queries/chain";
import { listDecisionsByProjectSlug } from "@/db/queries/decisions";
import { DEFAULT_PROJECT_SLUG } from "@/lib/default-project";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [decisions, chain] = await Promise.all([
    listDecisionsByProjectSlug(DEFAULT_PROJECT_SLUG),
    getChainSummary(DEFAULT_PROJECT_SLUG),
  ]);
  const committedCount = decisions.filter((d) => d.status === "committed").length;

  return (
    <main className="flex flex-1 flex-col w-full max-w-[1200px] mx-auto px-8 py-12 gap-10">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-hash-glow">
            resolve · decision log
          </p>
          <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-cloud-white">
            Strategic Decision Log
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-silver-mist">
            {decisions.length === 0
              ? "No decisions yet. Record the first one to start the chain."
              : `${decisions.length} decision${decisions.length === 1 ? "" : "s"} · ${committedCount} committed`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/chain"
            className="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-frost-line bg-transparent px-5 text-sm font-medium text-cloud-white transition-colors hover:bg-iron-panel"
          >
            Chain Status
          </Link>
          <Link
            href="/decisions/new"
            className="inline-flex h-10 items-center rounded-[var(--radius-button)] bg-integrity-emerald px-6 text-sm font-medium text-obsidian transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-integrity-emerald"
          >
            Record Decision
          </Link>
        </div>
      </header>

      {decisions.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="flex flex-col gap-3">
          {decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} />
          ))}
        </section>
      )}

      <footer className="flex gap-6 text-xs text-zinc-whisper">
        <span>Milestone M2 — Chain</span>
        <span className="font-mono">
          chain: {chain.length === 0
            ? "uninitialized"
            : chain.verify.ok
              ? `${chain.length} verified`
              : `broken at #${chain.verify.breakAt}`}
        </span>
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <section
      aria-labelledby="empty-state-heading"
      className="w-full rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas"
    >
      <div className="flex flex-col gap-2 p-6 border-l-[3px] border-l-proposed-amber">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-proposed-amber/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.05em] text-proposed-amber">
            empty
          </span>
          <span className="font-mono text-xs text-zinc-whisper">
            chain position #0
          </span>
        </div>
        <h2
          id="empty-state-heading"
          className="text-xl font-medium text-cloud-white"
        >
          No decisions yet
        </h2>
        <p className="text-sm leading-relaxed text-silver-mist">
          Record the first decision to start the chain. Every committed entry
          will extend a SHA-256 hash chain — tamper-evident, queryable, and
          shareable with agents via MCP.
        </p>
      </div>
    </section>
  );
}
