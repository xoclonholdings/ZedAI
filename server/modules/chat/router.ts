import { Router } from "express";
import { z } from "zod";
import { ENV } from "../../env";
import { ollamaChat, miniReason } from "./model";
import { systemPrompt, parseAction, clipMessages } from "./planner";
import { runTool, toolSchemas } from "./tools";
import { appendTurn, getHistory, getOrCreateThread, summarizeEpisodic } from "../memory/episodic";
import { retrieve } from "../rag/retriever";
import type { AskResponse } from "./types";

export const chatRouter = Router();
const AskSchema = z.object({ threadId: z.string().optional(), message: z.string().min(1), meta: z.any().optional() });

chatRouter.post("/ask", async (req, res) => {
  const v = AskSchema.safeParse(req.body);
  if (!v.success) return res.status(400).json({ error: "Invalid body" });
  const { threadId, message } = v.data;
  const thread = await getOrCreateThread(threadId);
  const ctx = await retrieve(message, ENV.RAG_TOPK).catch(()=>[]);
  const summary = thread?.summary ? thread.summary : "";

  await appendTurn(thread!.id, "user", message);

  const tools = Object.keys(toolSchemas);
  const msgs = clipMessages([
    { role:"system", content: systemPrompt(tools) },
    { role:"system", content: `Episodic summary:\n${summary||"(none)"}` },
    { role:"system", content: `RAG context:\n${ctx.map(c=>`- ${c.title||c.uri||""} :: ${c.text.slice(0,240)}`).join("\n") || "(none)"}` },
    ...(await getHistory(thread!.id)).map(t=>({ role: t.role as any, content: t.content }))
  ]);

  const raw = (await ollamaChat(msgs)) ?? (await miniReason(msgs));
  let steps: any[] = [];
  let answer = raw;

  // up to MAX_STEPS tool calls
  for (let i=0; i<ENV.MAX_STEPS; i++) {
    const act = parseAction(answer);
    if (!act) break;
    if (act.type === "final") { answer = act.final || ""; break; }
    if (act.type === "tool") {
      const schema = toolSchemas[act.name as keyof typeof toolSchemas];
      if (!schema) { answer = "Unknown tool."; break; }
      const parsed = schema.safeParse(act.args || {});
      if (!parsed.success) { answer = "Invalid tool args."; break; }
      const result = await runTool(act.name as any, parsed.data).catch(e=>({ error: String(e?.message||e) }));
      steps.push({ type: "tool", data: { name: act.name, args: parsed.data, result } });
      await appendTurn(thread!.id, "tool", JSON.stringify(result), { toolName: act.name, toolArgs: parsed.data, toolResult: result });
      // feed back to model
      const follow = (await ollamaChat([...msgs, { role:"assistant", content: JSON.stringify({ toolResult: result }) }])) ?? (await miniReason(msgs));
      answer = follow;
    }
  }

  await appendTurn(thread!.id, "assistant", answer);
  await summarizeEpisodic(thread!.id).catch(()=>{});

  const out: AskResponse = { answer, steps, citations: ctx, threadId: thread!.id };
  return res.json(out);
});

chatRouter.get("/history/:threadId", async (req, res) => {
  const turns = await getHistory(req.params.threadId).catch(()=>null);
  if (!turns) return res.status(404).json({ error: "thread not found" });
  res.json(turns);
});

export default chatRouter;
