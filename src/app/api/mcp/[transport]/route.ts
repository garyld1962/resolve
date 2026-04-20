import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyToken } from "@/mcp/auth";
import { recordDecisionTool } from "@/mcp/tools/record-decision";
import { commitDecisionTool } from "@/mcp/tools/commit-decision";
import { queryDecisionsTool } from "@/mcp/tools/query-decisions";
import { verifyChainTool } from "@/mcp/tools/verify-chain";
import { getImpactRadiusTool } from "@/mcp/tools/get-impact-radius";

const TOOLS = [
  recordDecisionTool,
  commitDecisionTool,
  queryDecisionsTool,
  verifyChainTool,
  getImpactRadiusTool,
] as const;

type GenericToolHandler = (args: unknown, extra?: unknown) => Promise<{
  content: { type: "text"; text: string }[];
  isError?: true;
}>;

const handler = createMcpHandler(
  (server) => {
    for (const t of TOOLS) {
      const toolHandler = t.handler as GenericToolHandler;
      server.tool(
        t.name,
        t.description,
        t.inputSchema.shape,
        async (args: unknown, extra: unknown) => toolHandler(args, extra),
      );
    }
  },
  {
    capabilities: {
      tools: Object.fromEntries(
        TOOLS.map((t) => [t.name, { description: t.description }]),
      ),
    },
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
