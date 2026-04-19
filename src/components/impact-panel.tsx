import Link from "next/link";
import {
  getImpactRadius,
  IMPACT_MIN_SHARED_TAGS,
  type ImpactItem,
} from "@/db/queries/impact";

/* Server component panel for the Decision Detail page. Fetches the impact
   radius for `decisionId` and renders the top items with shared tags
   highlighted in Reasoning Indigo. Empty state explains the threshold so
   users understand why the panel might be empty. */
export async function ImpactPanel({ decisionId }: { decisionId: string }) {
  const items = await getImpactRadius(decisionId);

  if (items.length === 0) {
    return (
      <section
        aria-label="Cross-project impact"
        className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-steel-edge bg-iron-panel p-5"
      >
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          Cross-project impact
        </p>
        <p className="text-sm text-zinc-whisper">
          No committed decisions in other projects share ≥
          {IMPACT_MIN_SHARED_TAGS} tags with this one yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Cross-project impact"
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          Cross-project impact
        </p>
        <span className="text-xs text-zinc-whisper">
          {items.length} match{items.length === 1 ? "" : "es"} · ≥
          {IMPACT_MIN_SHARED_TAGS} shared tags
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ImpactCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ImpactCard({ item }: { item: ImpactItem }) {
  const sharedSet = new Set(item.sharedTags);
  return (
    <li className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Link
          href={`/decisions/${item.id}`}
          className="text-sm font-medium text-cloud-white hover:text-reasoning-indigo"
        >
          {item.title}
        </Link>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-mono"
          style={{
            color: item.projectAccentColor,
            borderColor: item.projectAccentColor,
          }}
          title={`Project: ${item.projectName}`}
        >
          {item.projectName}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.tags.map((tag) => {
          const shared = sharedSet.has(tag);
          return (
            <span
              key={tag}
              className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                shared
                  ? "border-reasoning-indigo bg-reasoning-indigo/15 text-reasoning-indigo"
                  : "border-frost-line text-zinc-whisper"
              }`}
            >
              {tag}
            </span>
          );
        })}
      </div>
    </li>
  );
}
