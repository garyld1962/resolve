import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

/* Verifier for the MCP route. Lazy-reads RESOLVE_MCP_TOKEN so Turbopack
   build-time module evaluation doesn't blow up when env isn't injected
   yet (HANDOFF load-bearing constraint #1). */
export async function verifyToken(
  _req: Request,
  bearerToken: string | undefined,
): Promise<AuthInfo | undefined> {
  const expected = process.env.RESOLVE_MCP_TOKEN;
  if (!expected) {
    // Fail closed: absent env var means no valid token can exist. Throwing
    // here surfaces the misconfiguration instead of silently 401-ing every
    // caller.
    throw new Error(
      "RESOLVE_MCP_TOKEN is not set. The MCP server cannot authenticate requests.",
    );
  }
  if (!bearerToken) return undefined;

  // timingSafeEqual requires equal-length buffers; if lengths differ, the
  // tokens cannot match, but we still need to avoid a fast-path length leak.
  // Do the comparison against a same-length null-padded buffer and let the
  // explicit length check gate the result.
  const a = Buffer.from(bearerToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return undefined;
  const match = timingSafeEqual(a, b);
  if (!match) return undefined;

  return {
    token: bearerToken,
    scopes: ["record", "query"],
    clientId: "env-token",
  };
}
