import Link from "next/link";
import type { DecisionListItem } from "@/db/queries/decisions";
import { StatusBadge, statusLeftBorderClass } from "./status-badge";
import { TechnologyTagList } from "./technology-tag";

const RATIONALE_EXCERPT_CHARS = 200;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* Decision card per DESIGN.md §4: Slate Canvas bg, Steel Edge border, 8px radius,
   3px left border keyed on state. Hover → Frost Line border. */
export function DecisionCard({ decision }: { decision: DecisionListItem }) {
  const excerpt =
    decision.rationale.length > RATIONALE_EXCERPT_CHARS
      ? decision.rationale.slice(0, RATIONALE_EXCERPT_CHARS).trimEnd() + "…"
      : decision.rationale;

  return (
    <Link
      href={`/decisions/${decision.id}`}
      className={`group block rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas transition-colors hover:border-frost-line`}
    >
      <div
        className={`flex flex-col gap-3 p-5 border-l-[3px] ${statusLeftBorderClass(decision.status)}`}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-medium text-cloud-white group-hover:text-white">
            {decision.title}
          </h3>
          <div className="flex items-center gap-3 shrink-0">
            {decision.chainPosition !== null && (
              <span className="font-mono text-xs text-hash-glow">
                #{decision.chainPosition}
              </span>
            )}
            <StatusBadge status={decision.status} />
          </div>
        </div>

        <TechnologyTagList tags={decision.tags} />

        <p className="text-sm leading-relaxed text-silver-mist line-clamp-2">
          {excerpt}
        </p>

        <div className="flex items-center gap-4 text-xs text-zinc-whisper">
          <span className="font-mono">{decision.author}</span>
          <span>{formatDate(decision.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
