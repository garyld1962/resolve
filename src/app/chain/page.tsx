import Link from "next/link";
import { HashDisplay } from "@/components/hash-display";
import { getChainSummary } from "@/db/queries/chain";
import { toHex } from "@/lib/chain";
import { DEFAULT_PROJECT_SLUG } from "@/lib/default-project";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chain Status — Resolve",
};

const VERIFY_REASON_LABEL: Record<string, string> = {
  content_hash_mismatch: "Content hash mismatch (title/rationale/tags tampered)",
  prev_hash_mismatch: "Prev-hash mismatch (linkage forged)",
  entry_hash_mismatch: "Entry hash mismatch (hash field tampered)",
  position_gap: "Position gap (entry removed from chain)",
};

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

export default async function ChainStatusPage() {
  const summary = await getChainSummary(DEFAULT_PROJECT_SLUG);

  return (
    <main className="flex flex-1 flex-col w-full max-w-[960px] mx-auto px-8 py-12 gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.05em] text-hash-glow hover:text-integrity-emerald"
        >
          ← back to log
        </Link>
        <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-cloud-white">
          Chain Status
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-silver-mist">
          SHA-256 hash chain of every committed decision for this project. The
          Merkle root is recomputed on every view; verification walks the full
          chain end-to-end.
        </p>
      </header>

      <IntegrityBanner verify={summary.verify} />

      <section className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-[var(--radius-card)] border border-steel-edge bg-iron-panel p-6 sm:grid-cols-2">
        <MetaRow
          label="Chain length"
          value={`${summary.length} entr${summary.length === 1 ? "y" : "ies"}`}
          mono
        />
        <MetaRow
          label="Head position"
          value={summary.head ? `#${summary.head.chainPosition}` : "—"}
          mono
        />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs uppercase tracking-[0.05em] text-zinc-whisper">
            Merkle root
          </span>
          <HashDisplay hex={toHex(summary.merkleRoot)} tone="glow" />
        </div>
        {summary.head && (
          <>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.05em] text-zinc-whisper">
                Head entry hash
              </span>
              <HashDisplay hex={toHex(summary.head.entryHash)} tone="glow" />
            </div>
            <MetaRow
              label="Head committed"
              value={formatTimestamp(summary.head.committedAt)}
              mono
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.05em] text-zinc-whisper">
                Head decision
              </span>
              <Link
                href={`/decisions/${summary.head.decisionId}`}
                className="text-sm text-cloud-white hover:text-integrity-emerald"
              >
                {summary.head.title}
              </Link>
            </div>
          </>
        )}
      </section>

      <footer className="text-xs text-zinc-whisper">
        Nightly anchoring and external timestamping are out of scope for v1
        (PRD §3 Non-Goals). Root is recomputed on every page load for now.
      </footer>
    </main>
  );
}

function IntegrityBanner({
  verify,
}: {
  verify: Awaited<ReturnType<typeof getChainSummary>>["verify"];
}) {
  if (verify.ok) {
    return (
      <section
        aria-label="integrity ok"
        className="rounded-[var(--radius-card)] border border-integrity-emerald/40 bg-integrity-emerald/10 p-5"
      >
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-integrity-emerald">
          integrity · verified
        </p>
        <p className="mt-2 text-sm text-cloud-white">
          All {verify.length} chain entr{verify.length === 1 ? "y" : "ies"} verified.
          Every content hash, prev-hash, and entry hash recomputed successfully.
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="integrity broken"
      className="rounded-[var(--radius-card)] border border-conflicting-rose/40 bg-conflicting-rose/10 p-5"
    >
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-conflicting-rose">
        integrity · broken
      </p>
      <p className="mt-2 text-sm text-cloud-white">
        First break at chain position #{verify.breakAt}:{" "}
        {VERIFY_REASON_LABEL[verify.reason] ?? verify.reason}.
      </p>
    </section>
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
