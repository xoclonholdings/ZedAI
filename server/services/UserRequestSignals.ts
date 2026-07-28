import { storage } from "../storage/databaseStorage";
import { FlowStore } from "./FlowStore";

/**
 * Shared real-usage signal: what has this user actually asked for lately,
 * across chat messages and manually-launched flow briefs. Both
 * FlowSuggestionEngine (repeated-request -> shortcut suggestions) and
 * IntegrationGapEngine (mentioned-but-unconnected integration -> prompt to
 * connect it) read from the same source so "what ZAR noticed" always means
 * the same thing across both features.
 */

const MAX_CANDIDATES = 500;
const MAX_CONVERSATIONS = 40;

export interface UserRequestCandidate {
  text: string;
  at: number;
  source: "chat" | "run";
}

export async function gatherUserRequestCandidates(userId: string): Promise<UserRequestCandidate[]> {
  const candidates: UserRequestCandidate[] = [];

  try {
    const conversations = await storage.getConversationsByUser(userId);
    const recent = [...conversations]
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt as unknown as string).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt as unknown as string).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, MAX_CONVERSATIONS);

    for (const conversation of recent) {
      const messages = await storage.getMessagesByConversation(conversation.id).catch(() => []);
      for (const message of messages) {
        if (message.role !== "user" || !message.content?.trim()) continue;
        const at = message.createdAt ? new Date(message.createdAt as unknown as string).getTime() : Date.now();
        candidates.push({ text: message.content.trim(), at, source: "chat" });
      }
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  } catch {
    /* offline/fallback storage - proceed with whatever else we have */
  }

  try {
    const runs = await FlowStore.listRuns({ userId, limit: 200 });
    for (const run of runs) {
      const brief = (run.context as Record<string, unknown> | undefined)?.userBrief;
      if (typeof brief === "string" && brief.trim()) {
        candidates.push({
          text: brief.trim(),
          at: new Date(run.startedAt).getTime(),
          source: "run",
        });
      }
    }
  } catch {
    /* flow store unavailable - proceed with whatever else we have */
  }

  return candidates.slice(0, MAX_CANDIDATES);
}
