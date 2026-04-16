"use client";

import { useTransition } from "react";
import { commitDecisionAction } from "./actions";

export function CommitButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => commitDecisionAction(id))}
      className="inline-flex h-10 items-center rounded-[var(--radius-button)] bg-integrity-emerald px-6 text-sm font-medium text-obsidian transition-opacity hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Committing…" : "Commit to chain"}
    </button>
  );
}
