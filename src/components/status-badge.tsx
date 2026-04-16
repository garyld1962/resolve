import type { DecisionStatus } from "@/db/schema";

/* Maps decision status → token class per DESIGN.md §2 (Decision States).
   Badge style matches §4 Status Badges: 15% bg opacity, full-opacity text, uppercase. */
const STATUS_STYLES: Record<
  DecisionStatus,
  { bg: string; text: string; label: string }
> = {
  proposed: {
    bg: "bg-proposed-amber/15",
    text: "text-proposed-amber",
    label: "proposed",
  },
  committed: {
    bg: "bg-committed-emerald/15",
    text: "text-committed-emerald",
    label: "committed",
  },
};

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.05em] ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function statusLeftBorderClass(status: DecisionStatus): string {
  return status === "committed"
    ? "border-l-committed-emerald"
    : "border-l-proposed-amber";
}
