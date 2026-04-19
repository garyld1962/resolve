import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embed } from "./client";

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

describe("embed", () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-key";
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.env.VOYAGE_API_KEY = ORIGINAL_KEY;
  });

  it("posts to Voyage with the expected payload and returns vectors in input order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { embedding: new Array(1024).fill(0.1), index: 0 },
            { embedding: new Array(1024).fill(0.2), index: 1 },
          ],
          model: "voyage-3-large",
          usage: { total_tokens: 8 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const vectors = await embed(["alpha", "beta"], "document");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer test-key",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "voyage-3-large",
      input: ["alpha", "beta"],
      input_type: "document",
    });

    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(1024);
    expect(vectors[0][0]).toBe(0.1);
    expect(vectors[1][0]).toBe(0.2);
  });

  it("re-orders out-of-order responses by `index`", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { embedding: new Array(1024).fill(0.9), index: 1 },
            { embedding: new Array(1024).fill(0.1), index: 0 },
          ],
          model: "voyage-3-large",
          usage: { total_tokens: 4 },
        }),
        { status: 200 },
      ),
    );
    const vectors = await embed(["first", "second"], "document");
    expect(vectors[0][0]).toBe(0.1);
    expect(vectors[1][0]).toBe(0.9);
  });

  it("throws if VOYAGE_API_KEY is unset", async () => {
    delete process.env.VOYAGE_API_KEY;
    await expect(embed(["x"], "document")).rejects.toThrow(/VOYAGE_API_KEY/);
  });

  it("throws on non-200 with the response body in the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    await expect(embed(["x"], "document")).rejects.toThrow(/429.*rate limited/);
  });

  it("throws on dimension mismatch (defensive: API contract change)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ embedding: new Array(512).fill(0.1), index: 0 }],
          model: "voyage-3-large",
          usage: { total_tokens: 2 },
        }),
        { status: 200 },
      ),
    );
    await expect(embed(["x"], "document")).rejects.toThrow(/dimension/i);
  });
});
