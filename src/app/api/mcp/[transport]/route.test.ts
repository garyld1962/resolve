import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { POST } from "./route";

function parseMcpBody(body: string): { result?: { tools?: unknown[] }; tools?: unknown[] } {
  const trimmed = body.trimStart();
  if (trimmed.startsWith("{")) return JSON.parse(body);
  // SSE: find first "data: {...}" line and parse it.
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice("data: ".length));
    }
  }
  throw new Error(`Unrecognized MCP response body: ${body.slice(0, 120)}`);
}

/* The mcp-handler derives its streamable-HTTP endpoint as `${basePath}/mcp`.
   With basePath="/api/mcp", the adapter only matches pathname "/api/mcp/mcp".
   Next's [transport] dynamic segment resolves that (transport="mcp"). */
const BASE = "http://localhost:3000/api/mcp/mcp";

describe("mcp route handler", () => {
  const ORIG = process.env.RESOLVE_MCP_TOKEN;
  beforeAll(() => {
    process.env.RESOLVE_MCP_TOKEN = "route-test-token";
  });
  afterAll(() => {
    if (ORIG === undefined) delete process.env.RESOLVE_MCP_TOKEN;
    else process.env.RESOLVE_MCP_TOKEN = ORIG;
  });

  it("401s requests without a bearer token", async () => {
    const req = new Request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("lists all 5 tools with a valid token", async () => {
    const req = new Request(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer route-test-token",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const body = await res.text();
    /* Streamable-HTTP with Accept: text/event-stream returns SSE frames:
       "event: message\ndata: {...}\n\n". Without the SSE accept, it returns
       plain JSON. Parse either. */
    const payload = parseMcpBody(body);
    const tools = payload.result?.tools ?? payload.tools;
    expect(tools).toBeDefined();
    const names = (tools as { name: string }[])
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([
      "commit_decision",
      "get_impact_radius",
      "query_decisions",
      "record_decision",
      "verify_chain",
    ]);
  });

  it("rejects tools/call with a wrong token", async () => {
    const req = new Request(BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer WRONG",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });
});
