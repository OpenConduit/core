/**
 * Registry for tools contributed by extensions.
 *
 * Extensions call `api.tools.register(toolDef, handler)` in their `activate`
 * function. The registry stores the tool definition (forwarded to the AI as a
 * builtin tool) and the async handler that executes when the AI calls the tool.
 *
 * Execution flow:
 *  1. `beforeSend` hook merges all registered tool defs into `builtinTools`
 *  2. AI calls the tool → main process receives the call
 *  3. Main sends `chat:extension-tool-call` IPC to renderer
 *  4. `useChat` listens, looks up the handler here, runs it
 *  5. Result is sent back via `chat:extension-tool-result` IPC
 */

import type { McpTool } from '../types';

export const EXTENSION_SERVER_ID = '__extension__';

export type ToolHandler = (
  input: Record<string, unknown>,
) => string | Promise<string>;

interface ToolRegistration {
  tool: McpTool;
  handler: ToolHandler;
}

class ToolContributionRegistry {
  private readonly _tools = new Map<string, ToolRegistration>();

  /**
   * Register a tool + its execution handler.
   * Returns an unsubscribe function that removes the registration.
   */
  register(toolDef: Omit<McpTool, 'serverId'>, handler: ToolHandler): () => void {
    const tool: McpTool = { ...toolDef, serverId: EXTENSION_SERVER_ID };
    this._tools.set(tool.name, { tool, handler });
    return () => {
      this._tools.delete(tool.name);
    };
  }

  /** Returns all currently registered tool definitions. */
  getTools(): McpTool[] {
    return Array.from(this._tools.values()).map((r) => r.tool);
  }

  /** Call the handler for a named tool. Throws if the tool is not registered. */
  async call(name: string, input: Record<string, unknown>): Promise<string> {
    const reg = this._tools.get(name);
    if (!reg) throw new Error(`Extension tool "${name}" is not registered`);
    return reg.handler(input);
  }

  has(name: string): boolean {
    return this._tools.has(name);
  }
}

export const toolContributionRegistry = new ToolContributionRegistry();
