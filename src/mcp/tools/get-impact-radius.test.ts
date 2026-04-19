import "dotenv/config";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { getImpactRadiusTool } from "./get-impact-radius";

config({ path: ".env.local" });
const DB_URL = process.env.POSTGRES_URL_NON_POOLING;
const itDb = DB_URL ? it : it.skip;
const describeDb = DB_URL ? describe : describe.skip;

describeDb("getImpactRadiusTool", () => {
  itDb("returns NOT_FOUND for a missing id", async () => {
    const res = await getImpactRadiusTool.handler({
      // Valid v4 UUID shape that won't exist.
      decision_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(res.isError).toBe(true);
    const payload = JSON.parse(res.content[0].text);
    expect(payload.code).toBe("NOT_FOUND");
  });

  itDb("returns shape for a valid id in the seeded Resolve project", async () => {
    const { listDecisionsByProjectSlug } = await import(
      "@/db/queries/decisions"
    );
    const list = await listDecisionsByProjectSlug("resolve");
    const first = list.find((d) => d.chainPosition !== null);
    if (!first) return;
    const res = await getImpactRadiusTool.handler({ decision_id: first.id });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.decision_id).toBe(first.id);
    expect(Array.isArray(payload.impact)).toBe(true);
    for (const item of payload.impact) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.shared_tag_count).toBe("number");
      expect(Array.isArray(item.shared_tags)).toBe(true);
      expect(item.shared_tag_count).toBe(item.shared_tags.length);
    }
  });

  itDb("respects min_shared_tags override (client-side filter)", async () => {
    const { listDecisionsByProjectSlug } = await import(
      "@/db/queries/decisions"
    );
    const list = await listDecisionsByProjectSlug("resolve");
    const first = list.find((d) => d.chainPosition !== null);
    if (!first) return;
    const strict = await getImpactRadiusTool.handler({
      decision_id: first.id,
      min_shared_tags: 10,
    });
    const payload = JSON.parse(strict.content[0].text);
    expect(payload.impact.length).toBe(0);
  });
});
