import {
  extractTextFromContent,
  normalizeWhitespace,
  shortHash,
  summarizePreview,
  toIsoTime,
} from "./text-utils";
import type {
  ExportConversation,
  NormalizedConversation,
  NormalizedMessage,
  SourceName,
} from "./types";

/**
 * Convert one raw export conversation into the canonical
 * NormalizedConversation shape. Walks the `mapping` tree, recovers
 * messages, sorts them chronologically, and computes a fingerprint
 * from the title + first 8 message excerpts so cross-source
 * deduplication can find near-duplicates that have different IDs.
 *
 * Returns null when there's nothing useful to merge — e.g. an empty
 * conversation or one with no recoverable text content.
 */
export function normalizeConversation(
  input: ExportConversation,
  source: SourceName,
): NormalizedConversation | null {
  const mapping = input.mapping ?? {};
  const messages: NormalizedMessage[] = [];

  for (const [nodeId, node] of Object.entries(mapping)) {
    const message = (node as any)?.message;
    const role = message?.author?.role;
    const text = extractTextFromContent(message?.content);

    if (!role || !text) {
      continue;
    }

    messages.push({
      id: String(message?.id ?? nodeId),
      role: String(role),
      createTime: toIsoTime(message?.create_time ?? node?.create_time ?? null),
      text,
    });
  }

  if (messages.length === 0) {
    return null;
  }

  messages.sort((left, right) => {
    const leftValue = left.createTime ? Date.parse(left.createTime) : 0;
    const rightValue = right.createTime ? Date.parse(right.createTime) : 0;
    return leftValue - rightValue;
  });

  const title = normalizeWhitespace(input.title || "Untitled conversation");
  const conversationId = String(
    input.conversation_id ?? input.id ?? `${source}-${shortHash(title)}`,
  );
  const fingerprintSeed = [
    title.toLowerCase(),
    ...messages
      .slice(0, 8)
      .map((message) => `${message.role}:${message.text.toLowerCase().slice(0, 300)}`),
  ].join("\n");
  const fingerprint = shortHash(fingerprintSeed);

  return {
    canonicalKey: conversationId,
    conversationId,
    title,
    createdAt: toIsoTime(input.create_time ?? null),
    updatedAt: toIsoTime(input.update_time ?? null),
    sources: [source],
    sourceConversationIds: [conversationId],
    participants: [...new Set(messages.map((message) => message.role))],
    messageCount: messages.length,
    preview: summarizePreview(messages),
    fingerprint,
    messages,
  };
}

/**
 * Combines two NormalizedConversations that the de-dup pass decided
 * are the same conversation seen from different sources. Messages
 * are union'd by (role, createTime, text) tuple so the same turn
 * imported twice doesn't appear twice in the final timeline.
 *
 * Title keeps the longer of the two (longer titles tend to be more
 * specific). Created/updated take the min/max respectively.
 */
export function mergeConversation(
  existing: NormalizedConversation,
  incoming: NormalizedConversation,
): NormalizedConversation {
  const mergedMessageMap = new Map<string, NormalizedMessage>();
  for (const message of [...existing.messages, ...incoming.messages]) {
    const key = `${message.role}|${message.createTime ?? "unknown"}|${message.text}`;
    if (!mergedMessageMap.has(key)) {
      mergedMessageMap.set(key, message);
    }
  }

  const messages = [...mergedMessageMap.values()].sort((left, right) => {
    const leftValue = left.createTime ? Date.parse(left.createTime) : 0;
    const rightValue = right.createTime ? Date.parse(right.createTime) : 0;
    return leftValue - rightValue;
  });

  const title =
    existing.title.length >= incoming.title.length ? existing.title : incoming.title;
  const createdAt =
    [existing.createdAt, incoming.createdAt].filter(Boolean).sort()[0] ?? null;
  const updatedAt =
    [existing.updatedAt, incoming.updatedAt].filter(Boolean).sort().slice(-1)[0] ?? null;

  return {
    canonicalKey: existing.canonicalKey,
    conversationId: existing.conversationId,
    title,
    createdAt,
    updatedAt,
    sources: [...new Set([...existing.sources, ...incoming.sources])],
    sourceConversationIds: [
      ...new Set([...existing.sourceConversationIds, ...incoming.sourceConversationIds]),
    ],
    participants: [...new Set([...existing.participants, ...incoming.participants])],
    messageCount: messages.length,
    preview: summarizePreview(messages),
    fingerprint: existing.fingerprint,
    messages,
  };
}
