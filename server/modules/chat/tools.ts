import { z } from "zod";
export const toolSchemas = {
  time: z.object({}).strict(),
  calc: z.object({ expr: z.string().min(1) }).strict(),
};
export type ToolName = keyof typeof toolSchemas;

export async function runTool(name: ToolName, args: any) {
  switch (name) {
    case "time": return { now: new Date().toISOString() };
    case "calc":
      // very safe eval: only digits + ops
      if (!/^[0-9+\-*/().\s]+$/.test(args.expr)) throw new Error("Invalid characters in expr");
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict";return (${args.expr})`)();
      return { result: val };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
