/* How a list tool answers (MCP load, 12 Nov): its data as structured content, and the same data, as JSON, as its text.
   One shape every time, whichever of the two an AI tool reads, and whether a list was filtered or not. No indent: a
   list is sent twice, and the indent alone was a quarter of find_goals' text (#249's review). find_goals, every
   list_ tool and get_activity answer this way; src/mcp/mcp.test.ts checks each one. */
import type { ToolResult } from './tools';

export const listed = (data: Record<string, unknown>): ToolResult => ({ data, text: JSON.stringify(data) });
