import Link from "next/link";
import {
  getCrossProjectImpactPairs,
  IMPACT_MIN_SHARED_TAGS,
  type ImpactEndpoint,
} from "@/db/queries/impact";
import { listProjects } from "@/db/queries/projects";

export const dynamic = "force-dynamic";

export default async function CrossImpactPage() {
  const [pairs, projects] = await Promise.all([
    getCrossProjectImpactPairs(),
    listProjects(),
  ]);

  return (
    <main className="flex flex-1 flex-col w-full max-w-[1200px] mx-auto px-8 py-12 gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-reasoning-indigo">
          resolve · cross-impact
        </p>
        <h1 className="text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-cloud-white">
          Cross-project impact
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-silver-mist">
          Pairs of committed decisions across different projects that share ≥
          {IMPACT_MIN_SHARED_TAGS} tags. {pairs.length} pair
          {pairs.length === 1 ? "" : "s"} across {projects.length} project
          {projects.length === 1 ? "" : "s"}.
        </p>
      </header>

      {pairs.length === 0 ? (
        <section
          aria-label="No impact yet"
          className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-6"
        >
          <p className="text-sm text-silver-mist">
            No cross-project pairs yet. Record committed decisions in different
            projects with overlapping tags — pairs sharing ≥
            {IMPACT_MIN_SHARED_TAGS} tags will appear here automatically.
          </p>
        </section>
      ) : (
        <ol className="flex flex-col gap-4">
          {pairs.map((pair) => (
            <li
              key={`${pair.a.id}-${pair.b.id}`}
              className="rounded-[var(--radius-card)] border border-steel-edge bg-slate-canvas p-5"
            >
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="font-mono text-reasoning-indigo">
                  {pair.sharedTags.length} shared
                </span>
                <span className="text-zinc-whisper">·</span>
                <div className="flex flex-wrap gap-1.5">
                  {pair.sharedTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-reasoning-indigo bg-reasoning-indigo/15 px-2 py-0.5 font-mono text-xs text-reasoning-indigo"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <EndpointCard endpoint={pair.a} sharedTags={pair.sharedTags} />
                <EndpointCard endpoint={pair.b} sharedTags={pair.sharedTags} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function EndpointCard({
  endpoint,
  sharedTags,
}: {
  endpoint: ImpactEndpoint;
  sharedTags: string[];
}) {
  const sharedSet = new Set(sharedTags);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-frost-line bg-iron-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/decisions/${endpoint.id}`}
          className="text-sm font-medium text-cloud-white hover:text-reasoning-indigo"
        >
          {endpoint.title}
        </Link>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-mono"
          style={{
            color: endpoint.projectAccentColor,
            borderColor: endpoint.projectAccentColor,
          }}
        >
          {endpoint.projectName}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {endpoint.tags.map((t) => (
          <span
            key={t}
            className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
              sharedSet.has(t)
                ? "border-reasoning-indigo bg-reasoning-indigo/15 text-reasoning-indigo"
                : "border-frost-line text-zinc-whisper"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
