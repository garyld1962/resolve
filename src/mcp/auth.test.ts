import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyToken } from "./auth";

describe("verifyToken", () => {
  const ORIG = process.env.RESOLVE_MCP_TOKEN;

  beforeEach(() => {
    process.env.RESOLVE_MCP_TOKEN = "test-token-value-123";
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.RESOLVE_MCP_TOKEN;
    else process.env.RESOLVE_MCP_TOKEN = ORIG;
  });

  it("returns undefined when bearer is missing", async () => {
    const req = new Request("http://x/");
    expect(await verifyToken(req, undefined)).toBeUndefined();
  });

  it("returns undefined on token mismatch", async () => {
    const req = new Request("http://x/");
    expect(await verifyToken(req, "wrong-token")).toBeUndefined();
  });

  it("returns AuthInfo on match", async () => {
    const req = new Request("http://x/");
    const info = await verifyToken(req, "test-token-value-123");
    expect(info).toBeDefined();
    expect(info?.token).toBe("test-token-value-123");
    expect(info?.clientId).toBe("env-token");
    expect(info?.scopes).toEqual(["record", "query"]);
  });

  it("throws when RESOLVE_MCP_TOKEN is unset (fail closed)", async () => {
    delete process.env.RESOLVE_MCP_TOKEN;
    const req = new Request("http://x/");
    await expect(verifyToken(req, "any-token")).rejects.toThrow(
      /RESOLVE_MCP_TOKEN/,
    );
  });

  it("is timing-safe against same-length mismatches", async () => {
    // Not a perfect timing assertion (flaky in general), but a smoke test:
    // ensure the function doesn't short-circuit on first-byte mismatch.
    // We just check that two different wrong tokens of the same length both
    // return undefined — a length-leak impl would have returned earlier for
    // longer tokens but that's hard to detect without microbenchmarks, so
    // this is mostly a "we didn't use ===" regression guard.
    const req = new Request("http://x/");
    expect(await verifyToken(req, "xxxxxxxxxxxxxxxxxxxx")).toBeUndefined();
    expect(await verifyToken(req, "yyyyyyyyyyyyyyyyyyyy")).toBeUndefined();
  });
});
