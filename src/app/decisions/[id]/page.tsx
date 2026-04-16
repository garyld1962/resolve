import Link from "next/link";
import { notFound } from "next/navigation";
import { HashDisplay } from "@/components/hash-display";
import { StatusBadge } from "@/components/status-badge";
import { TechnologyTagList } from "@/components/technology-tag";
import { getDecisionById } from "@/db/queries/decisions";
import { toHex } from "@/lib/chain";
import { CommitButton } from "./commit-button";

export const dynamic = "force-dynamic";

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decision = await getDecisionById(id);
  if (!decision) notFound();

  const onChain =
    decision.status === "committed" &&
    decision.chainPosition !== null &&
    decision.entryHash !== null;

  return (
    <main className="flex flex-1 flex-col w-full max-w-[960px] mx-auto px-8 py-12 gap-10">
      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.05em] text-hash-glow hover:text-integrity-emerald"
        >
          ← back to log
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[1.5rem] font-medium leading-snug tracking-[-0.01em] text-cloud-white">
            {decision.title}
          </h1>
          <div className="flex items-center gap-3">
            {onChain && decision.chainPosition !== null && (
              <span className="font-mono text-xs text-hash-glow">
                #{decision.chainPosition}
              </span>
            )}
            <StatusBadge status={decision.status} />
          </div>
        </div>
        <TechnologyTagList tags={decision.tags} />
      </div>

      <article className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.65] text-cloud-white">
          {decision.rationale}
        </pre>
      </article>

      <section
        aria-label="Metadata"
        className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-[var(--radius-card)] border border-steel-edge bg-iron-panel p-6 sm:grid-cols-2"
      >
        <MetaRow label="Author" value={decision.author} mono />
        <MetaRow label="Project" value={decision.projectName} />
        <MetaRow
          label="Created"
          value={formatTimestamp(decision.createdAt)}
          mono
        />
        <MetaRow
          label="Committed"
          value={
            decision.committedAt
              ? formatTimestamp(decision.committedAt)
              : "—"
          }
          mono
        />
        {decision.linearIssueIds.length > 0 && (
          <MetaRow
            label="Linear issues"
            value={decision.linearIssueIds.join(", ")}
            mono
          />
        )}
      </section>

      {onChain && decision.entryHash && (
        <section
          aria-label="Chain entry"
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-integrity-emerald/30 bg-slate-canvas p-6 border-l-[3px] border-l-integrity-emerald"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.05em] text-integrity-emerald">
              chain entry · verified
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.05em] text-zinc-whisper">
              Entry hash
            </span>
            <HashDisplay hex={toHex(decision.entryHash)} tone="glow" />
          </div>
          <p className="text-xs text-zinc-whisper">
            Position #{decision.chainPosition}. Full chain view and Merkle root{" "}
            <Link
              href="/chain"
              className="underline decoration-dotted underline-offset-2 hover:text-integrity-emerald"
            >
              on the chain status page
            </Link>
            .
          </p>
        </section>
      )}

      {decision.status === "committed" && !onChain && (
        <section
          aria-label="Off-chain decision"
          className="rounded-[var(--radius-card)] border border-superseded-stone/40 bg-slate-canvas p-5 text-sm text-silver-mist"
        >
          Committed before chain hashing was introduced (pre-M2). Displayed but
          not part of the integrity chain.
        </section>
      )}

      {decision.status === "proposed" && (
        <div className="flex items-center gap-3">
          <CommitButton id={decision.id} />
          <p className="text-xs text-zinc-whisper">
            Committing extends the SHA-256 chain and marks this decision
            immutable.
          </p>
        </div>
      )}
    </main>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-[0.05em] text-zinc-whisper">
        {label}
      </span>
      <span className={`text-sm text-cloud-white ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
