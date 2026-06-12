export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ToolRegistryOptions = { directiveRoot: string; profile?: string; };

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

export type ToolExecutorMap = Record<string, ToolExecutor>;
