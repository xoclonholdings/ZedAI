import { prisma } from "../../db/prisma";

export async function getOrCreateThread(threadId?: string) {
  if (threadId) return prisma.conversation.findUnique({ where: { id: threadId } });
  return prisma.conversation.create({ data: {} });
}

export async function appendTurn(conversationId: string, role: string, content: string, extras?: Partial<{toolName:string;toolArgs:any;toolResult:any}>) {
  const count = await prisma.turn.count({ where: { conversationId } });
  await prisma.turn.create({
    data: {
      conversationId, role, content, idx: count,
      toolName: extras?.toolName, toolArgs: extras?.toolArgs as any, toolResult: extras?.toolResult as any
    }
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
}

export async function getHistory(conversationId: string) {
  return prisma.turn.findMany({ where: { conversationId }, orderBy: { idx: "asc" } });
}

export async function summarizeEpisodic(conversationId: string) {
  const turns = await getHistory(conversationId);
  const lastUser = turns.filter(t => t.role === "user").slice(-3).map(t => t.content);
  const bullets = lastUser.map(t => "- " + t.slice(0,120));
  const summary = bullets.join("\n");
  await prisma.conversation.update({ where: { id: conversationId }, data: { summary } });
  return summary;
}
