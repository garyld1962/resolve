"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recordDecisionAction, type RecordFormState } from "./actions";

const INITIAL_STATE: RecordFormState = {};

const FIELD_LABEL = "text-xs font-medium uppercase tracking-[0.05em] text-silver-mist";
const FIELD_INPUT =
  "w-full rounded-[var(--radius-button)] border border-steel-edge bg-iron-panel px-3 py-2 text-sm text-cloud-white placeholder:text-zinc-whisper focus:border-reasoning-indigo focus:outline-none focus:ring-1 focus:ring-reasoning-indigo";

export function RecordForm() {
  const [state, formAction, pending] = useActionState(
    recordDecisionAction,
    INITIAL_STATE,
  );
  const values = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className={FIELD_LABEL}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          defaultValue={values?.title}
          placeholder="Standardize on NATS JetStream for messaging"
          className={FIELD_INPUT}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="rationale" className={FIELD_LABEL}>
          Rationale (markdown)
        </label>
        <textarea
          id="rationale"
          name="rationale"
          required
          rows={10}
          defaultValue={values?.rationale}
          placeholder="Why this decision? What alternatives were considered? What trade-offs?"
          className={`${FIELD_INPUT} font-mono leading-relaxed`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="tags" className={FIELD_LABEL}>
            Technology tags
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={values?.tags}
            placeholder="NATS, messaging, event-driven"
            className={FIELD_INPUT}
          />
          <span className="text-xs text-zinc-whisper">
            Comma-separated. Free-text for now.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="linearIssueIds" className={FIELD_LABEL}>
            Linear issue IDs
          </label>
          <input
            id="linearIssueIds"
            name="linearIssueIds"
            type="text"
            defaultValue={values?.linearIssueIds}
            placeholder="RES-42, RES-108"
            className={FIELD_INPUT}
          />
          <span className="text-xs text-zinc-whisper">
            Stored now, linked bidirectionally in M6.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="author" className={FIELD_LABEL}>
          Author
        </label>
        <input
          id="author"
          name="author"
          type="text"
          required
          defaultValue={values?.author}
          placeholder="Gary Davidson"
          className={FIELD_INPUT}
        />
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-[var(--radius-button)] border border-conflicting-rose/40 bg-conflicting-rose/10 px-4 py-3 text-sm text-conflicting-rose"
        >
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-[var(--radius-button)] bg-integrity-emerald px-6 text-sm font-medium text-obsidian transition-opacity hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Recording…" : "Record as Proposed"}
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-[var(--radius-button)] border border-frost-line bg-transparent px-6 text-sm font-medium text-cloud-white transition-colors hover:bg-iron-panel"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
