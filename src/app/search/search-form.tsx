"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function SearchForm({ knownTags }: { knownTags: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const currentQ = params.get("q") ?? "";
  const currentTags = new Set(params.getAll("tag"));
  const currentStatus = params.get("status") ?? "";

  function update(next: URLSearchParams) {
    start(() => router.push(`/search?${next.toString()}`));
  }

  function toggleTag(tag: string) {
    const next = new URLSearchParams(params);
    next.delete("tag");
    const after = new Set(currentTags);
    if (after.has(tag)) after.delete(tag);
    else after.add(tag);
    after.forEach((t) => next.append("tag", t));
    update(next);
  }

  function setStatus(status: string) {
    const next = new URLSearchParams(params);
    if (status) next.set("status", status);
    else next.delete("status");
    update(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    update(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          name="q"
          defaultValue={currentQ}
          placeholder="how did we handle eventual consistency last time?"
          className="flex-1 h-11 rounded-[var(--radius-button)] border border-frost-line bg-iron-panel px-4 text-sm text-cloud-white placeholder:text-zinc-whisper focus:outline-2 focus:outline-reasoning-indigo"
          aria-label="Semantic search query"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-[var(--radius-button)] bg-reasoning-indigo px-5 text-sm font-medium text-cloud-white transition-opacity disabled:opacity-60"
        >
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {knownTags.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter by tag"
        >
          {knownTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={currentTags.has(tag)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                currentTags.has(tag)
                  ? "border-reasoning-indigo bg-reasoning-indigo/15 text-reasoning-indigo"
                  : "border-frost-line text-silver-mist hover:bg-iron-panel"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2" role="group" aria-label="Filter by status">
        {[
          { v: "", label: "All" },
          { v: "committed", label: "Committed" },
          { v: "proposed", label: "Proposed" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setStatus(opt.v)}
            aria-pressed={currentStatus === opt.v}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              currentStatus === opt.v
                ? "border-cloud-white text-cloud-white"
                : "border-frost-line text-silver-mist hover:bg-iron-panel"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
