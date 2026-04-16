import Link from "next/link";
import { RecordForm } from "./record-form";

export const metadata = {
  title: "Record Decision — Resolve",
};

export default function NewDecisionPage() {
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
          Record Decision
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-silver-mist">
          Captured as <span className="font-mono text-proposed-amber">proposed</span>.
          Commit later to extend the chain.
        </p>
      </header>
      <RecordForm />
    </main>
  );
}
