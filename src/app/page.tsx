export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center w-full max-w-[1200px] mx-auto px-8 py-24 gap-12">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-hash-glow">
          resolve · v0.1.0
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-cloud-white">
          Strategic Decision Log
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-silver-mist">
          Record, chain, and trace every decision behind the code — with AI
          that flags contradictions before you ship them.
        </p>
      </header>

      <section
        aria-labelledby="empty-state-heading"
        className="w-full rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas"
      >
        <div className="flex flex-col gap-2 p-5 border-l-[3px] border-l-proposed-amber">
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
            extends a SHA-256 hash chain — tamper-evident, queryable, and
            shareable with agents via MCP.
          </p>
        </div>
      </section>

      <footer className="flex gap-6 text-xs text-zinc-whisper">
        <span>Milestone M0 — Scaffold</span>
        <span className="font-mono">chain: uninitialized</span>
      </footer>
    </main>
  );
}
