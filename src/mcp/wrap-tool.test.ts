import { describe, expect, it } from "vitest";
import { ToolError, wrapTool } from "./wrap-tool";

describe("wrapTool", () => {
  it("wraps a success payload in MCP content shape", async () => {
    const handler = wrapTool(async () => ({ hello: "world" }));
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify({ hello: "world" }) },
    ]);
  });

  it("wraps a ToolError as an error response with the code", async () => {
    const handler = wrapTool(async () => {
      throw new ToolError("NOT_FOUND", "nothing here");
    });
    const result = await handler({});
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.code).toBe("NOT_FOUND");
    expect(payload.message).toBe("nothing here");
  });

  it("includes retryable flag when set", async () => {
    const handler = wrapTool(async () => {
      throw new ToolError("EMBEDDING_FAILED", "voyage 503", { retryable: true });
    });
    const result = await handler({});
    const payload = JSON.parse(result.content[0].text);
    expect(payload.retryable).toBe(true);
  });

  it("re-throws non-ToolError exceptions", async () => {
    const handler = wrapTool(async () => {
      throw new Error("db dead");
    });
    await expect(handler({})).rejects.toThrow(/db dead/);
  });
});
