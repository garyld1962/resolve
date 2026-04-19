/* MCP tool response envelope. All our tools return JSON payloads as text.
   On business errors (tagged with ToolError), return a structured error
   response so the agent can branch on code. On infra errors (anything
   else), let the exception propagate — withMcpAuth / mcp-handler will
   translate to MCP InternalError. */

export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly options: { retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ToolError";
  }
}

type McpToolResponse = {
  content: { type: "text"; text: string }[];
  isError?: true;
};

export function wrapTool<Args>(
  fn: (args: Args, extra?: unknown) => Promise<unknown>,
): (args: Args, extra?: unknown) => Promise<McpToolResponse> {
  return async (args, extra) => {
    try {
      const payload = await fn(args, extra);
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
      };
    } catch (err) {
      if (err instanceof ToolError) {
        const body: Record<string, unknown> = {
          code: err.code,
          message: err.message,
        };
        if (err.options.retryable) body.retryable = true;
        return {
          content: [{ type: "text", text: JSON.stringify(body) }],
          isError: true,
        };
      }
      throw err;
    }
  };
}
