import "server-only";
import { NextResponse } from "next/server";
import { searchDecisions } from "@/db/queries/search";
import { embed } from "@/lib/voyage";
import type { DecisionStatus } from "@/db/schema/decisions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES: DecisionStatus[] = ["proposed", "committed"];
const MAX_LIMIT = 50;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Missing required query parameter `q`" },
      { status: 400 },
    );
  }

  const projectSlug = searchParams.get("project") ?? undefined;
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw && (VALID_STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as DecisionStatus)
      : undefined;
  const tags = searchParams.getAll("tag").filter(Boolean);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw
    ? Math.min(Math.max(parseInt(limitRaw, 10) || 0, 1), MAX_LIMIT)
    : 20;

  const [queryVector] = await embed([q], "query");
  const results = await searchDecisions({
    queryVector,
    projectSlug,
    status,
    tags: tags.length > 0 ? tags : undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit,
  });

  return NextResponse.json({ q, count: results.length, results });
}
