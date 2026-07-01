import { MemoryService } from "./memoryService";
import { governZedResponse, userRequestedSourceLinks } from "./ZedResponseGovernance";

export const ZED_VOICE_MEMORY_KEY = "zed_voice_memory";

export type ZedVoiceMode = "chat" | "research" | "build" | "strategy" | "memory";

export interface VoiceMemoryEntry {
  value: string;
  source: string;
  addedAt: string;
  confidence: number;
}

export interface VoiceCorrection {
  timestamp: string;
  userId: string;
  conversationId?: string;
  correction: string;
  previousAssistantExcerpt?: string;
  approvedPhrases: string[];
  rejectedPhrases: string[];
  inferredRules: string[];
}

export interface ZedVoiceMemory {
  schemaVersion: 1;
  voicePrinciples: VoiceMemoryEntry[];
  approvedPhrases: VoiceMemoryEntry[];
  rejectedPhrases: VoiceMemoryEntry[];
  domainLanguage: VoiceMemoryEntry[];
  productPhilosophy: VoiceMemoryEntry[];
  tonePreferences: VoiceMemoryEntry[];
  responsePatternsWorked: VoiceMemoryEntry[];
  responsePatternsFailed: VoiceMemoryEntry[];
  domainCommunicationRules: VoiceMemoryEntry[];
  contextBehavior: VoiceMemoryEntry[];
  responseExamples: Array<{
    context: string;
    example: string;
    source: string;
    addedAt: string;
    confidence: number;
  }>;
  correctionHistory: VoiceCorrection[];
  confidence: number;
  lastUpdated: string;
}

export interface ZedPresentationChecks {
  accurate: boolean;
  grounded: boolean;
  properVoice: boolean;
  internalLeakFree: boolean;
  shouldAskBeforeAnswering: boolean;
  mobileUseful: boolean;
  conciseUnlessDepthRequested: boolean;
}

export interface ZedPresentationResult {
  content: string;
  checks: ZedPresentationChecks;
  adjustments: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function entry(value: string, source = "canonical-default", confidence = 0.72): VoiceMemoryEntry {
  return { value, source, addedAt: nowIso(), confidence };
}

function clampConfidence(value: number): number {
  return Math.max(0.05, Math.min(0.98, Number(value.toFixed(2))));
}

function uniqueEntries(entries: VoiceMemoryEntry[], limit = 100): VoiceMemoryEntry[] {
  const seen = new Set<string>();
  const output: VoiceMemoryEntry[] = [];

  for (const item of entries) {
    const key = item.value.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output.slice(0, limit);
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function defaultVoiceMemory(): ZedVoiceMemory {
  const timestamp = nowIso();

  return {
    schemaVersion: 1,
    voicePrinciples: [
      entry("ZED does not imitate the user; ZED becomes consistent by learning from confirmed knowledge, corrections, and operating outcomes."),
      entry("ZED answers as an operating intelligence for the Zebulon Commander ecosystem, not as a generic assistant."),
      entry("ZED leads with the useful answer, then adds only the context needed to act."),
      entry("ZED challenges weak assumptions plainly when risk, accuracy, or canonical knowledge requires it."),
      entry("ZED asks for context when a confident answer would require guessing."),
    ],
    approvedPhrases: [],
    rejectedPhrases: [
      entry("As an AI language model"),
      entry("Great question!"),
      entry("I hope this helps"),
      entry("Executive Summary"),
      entry("Key Findings"),
      entry("Recommended Action"),
      entry("Next move"),
      entry("Source trail"),
      entry("Confidence Level"),
      entry("Research Brief"),
      entry("Findings"),
      entry("Give me one more constraint"),
    ],
    domainLanguage: [
      entry("ZED"),
      entry("Zebulon Commander"),
      entry("foundation memory"),
      entry("core memory"),
      entry("project memory"),
      entry("canonical knowledge"),
      entry("presentation layer"),
      entry("voice memory"),
    ],
    productPhilosophy: [
      entry("Canonical knowledge is the source of voice; prompt personality is only a rendering layer."),
      entry("Memory should preserve confirmed decisions, corrections, vocabulary, and operating rules."),
      entry("Internal workflow details stay internal unless the user asks for implementation details."),
    ],
    tonePreferences: [
      entry("Direct, specific, mobile-readable, and calm."),
      entry("Concise by default; depth only when requested or required by risk."),
      entry("No generic consultant language, fake certainty, robotic report headings, or canned response templates."),
    ],
    responsePatternsWorked: [
      entry("Answer first, then explain only the constraint needed to act."),
      entry("Use compact bullets for multiple concrete items."),
      entry("Ask one precise question when the missing fact changes the answer."),
    ],
    responsePatternsFailed: [
      entry("Large default reports for simple questions."),
      entry("Repeating the user's request as preamble."),
      entry("Showing source trails, tool names, or workflow details without being asked."),
      entry("Treating old or internal memory as current external truth."),
      entry("Appending templated next-step language to every response."),
    ],
    domainCommunicationRules: [
      entry("Do not present old data as current truth; verify it or state the date boundary."),
      entry("Use canonical memory when it is relevant, but do not expose private memory mechanics."),
      entry("Do not mimic the user's wording style closely; learn stable operating preferences instead."),
      entry("Avoid source lists unless the user asks for sources or the task requires citations."),
      entry("Never add canned conversational fallback text. If a pipeline fails, report the concrete failure or missing input."),
    ],
    contextBehavior: [
      entry("Be direct for implementation, configuration, and operational decisions."),
      entry("Be reflective when the user is defining identity, values, or product direction."),
      entry("Challenge when a request conflicts with canonical rules, safety, accuracy, or known product philosophy."),
      entry("Summarize when the conversation has accumulated decisions or the user asks for recap."),
      entry("Produce a plan for multi-step work, high-risk work, or ambiguous execution."),
      entry("Ask for context when the missing detail materially changes the result."),
    ],
    responseExamples: [],
    correctionHistory: [],
    confidence: 0.7,
    lastUpdated: timestamp,
  };
}

function normalizeVoiceMemory(input: Partial<ZedVoiceMemory> | null): ZedVoiceMemory {
  const base = defaultVoiceMemory();
  if (!input) return base;

  return {
    schemaVersion: 1,
    voicePrinciples: uniqueEntries([...(input.voicePrinciples || []), ...base.voicePrinciples]),
    approvedPhrases: uniqueEntries(input.approvedPhrases || []),
    rejectedPhrases: uniqueEntries([...(input.rejectedPhrases || []), ...base.rejectedPhrases]),
    domainLanguage: uniqueEntries([...(input.domainLanguage || []), ...base.domainLanguage]),
    productPhilosophy: uniqueEntries([...(input.productPhilosophy || []), ...base.productPhilosophy]),
    tonePreferences: uniqueEntries([...(input.tonePreferences || []), ...base.tonePreferences]),
    responsePatternsWorked: uniqueEntries([...(input.responsePatternsWorked || []), ...base.responsePatternsWorked]),
    responsePatternsFailed: uniqueEntries([...(input.responsePatternsFailed || []), ...base.responsePatternsFailed]),
    domainCommunicationRules: uniqueEntries([...(input.domainCommunicationRules || []), ...base.domainCommunicationRules]),
    contextBehavior: uniqueEntries([...(input.contextBehavior || []), ...base.contextBehavior]),
    responseExamples: Array.isArray(input.responseExamples) ? input.responseExamples.slice(-30) : [],
    correctionHistory: Array.isArray(input.correctionHistory) ? input.correctionHistory.slice(-100) : [],
    confidence: clampConfidence(input.confidence ?? base.confidence),
    lastUpdated: input.lastUpdated || base.lastUpdated,
  };
}

function list(entries: VoiceMemoryEntry[], limit = 8): string {
  return entries.slice(0, limit).map((item) => `- ${item.value}`).join("\n");
}

function extractQuotedPhrases(text: string): string[] {
  const output = new Set<string>();
  for (const pattern of [/"([^"]{2,120})"/g, /'([^']{2,120})'/g, /`([^`]{2,120})`/g]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) output.add(match[1].trim());
  }
  return Array.from(output).slice(0, 8);
}

function correctionRules(text: string): string[] {
  const rules: string[] = [];
  if (/\btoo (long|verbose)\b|\bmore concise\b/i.test(text)) rules.push("Default to a shorter answer unless depth is requested.");
  if (/\btoo robotic\b|\brobotic\b|\bsounds like chatgpt\b/i.test(text)) rules.push("Avoid robotic headings, assistant cliches, and template-like phrasing.");
  if (/\btoo generic\b|\bgeneric\b|\bconsultant\b/i.test(text)) rules.push("Replace generic consultant language with specific project-aware wording.");
  if (/\bask before\b|\bshould have asked\b|\bdon't assume\b|\bdo not assume\b/i.test(text)) rules.push("Ask one precise clarifying question before answering when a missing detail changes the result.");
  if (/\bnot my voice\b|\bimitat/i.test(text)) rules.push("Do not mimic the user's voice; maintain ZED's operational voice.");
  if (/\btemplate|templated|canned|next move|no response/i.test(text)) rules.push("Never use canned conversational fallback text or expose empty response placeholders.");
  return rules;
}

function isLikelyVoiceCorrection(text: string): boolean {
  return /\b(wording|tone|framing|phrasing|phrase|assumption|too generic|too robotic|too long|too verbose|more concise|less formal|ask before|should have asked|don't assume|do not assume|do not say|don't say|stop saying|avoid saying|say instead|use instead|instead say|instead use|approved wording|approved phrase|rejected wording|rejected phrase|not my voice|not zed|sounds like chatgpt|template|templated|canned|next move|no response)\b/i.test(text);
}

function extractAfter(text: string, patterns: RegExp[]): string[] {
  return patterns
    .map((pattern) => text.match(pattern)?.[1]?.trim().replace(/[.!?]+$/, ""))
    .filter((value): value is string => Boolean(value && value.length >= 2 && value.length <= 160));
}

function removeRejectedLanguage(content: string, memory: ZedVoiceMemory): string {
  let output = content;
  for (const item of memory.rejectedPhrases) {
    if (item.value.length < 3) continue;
    const escaped = item.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escaped, "gi"), "");
  }
  return output.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function removeLeakage(content: string): string {
  return content
    .split("\n")
    .filter((line) => !/\b(system prompt|developer message|internal parse format|memory context|tool call|ollama|chroma|vector store|scratchpad memory|source_strength|next_step:|points:|meaning:)\b/i.test(line.trim()))
    .join("\n")
    .trim();
}

function removeCannedResponseLanguage(content: string): string {
  return content
    .replace(/^\s*next\s+move\s*:\s*/gim, "")
    .replace(/^\s*recommended\s+action\s*:\s*/gim, "")
    .replace(/^\s*confidence(?:\s+level)?\s*:\s*/gim, "")
    .replace(/^\s*(?:key\s+findings|findings|executive\s+summary|research\s+brief)\s*:?\s*$/gim, "")
    .replace(/\(no response\)/gi, "")
    .replace(/\bgive me one more constraint or target,? and i can turn this into a cleaner action plan\.?/gi, "")
    .replace(/\bgive me the specific competitor set or market,? and i can turn this into a tighter action plan\.?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasRoboticHeading(content: string): boolean {
  return /^#{1,4}\s*(Executive Summary|Key Findings|Findings|Recommended Action|Confidence|Analysis Results|Final Assessment|Research Brief)\b/im.test(content);
}

function isMobileUseful(content: string): boolean {
  return content.split("\n").every((line) => line.length <= 180 || /^```/.test(line));
}

function wantsDepth(message: string): boolean {
  return /\b(deep|detailed|full|explain|walk me through|long form|comprehensive|thorough)\b/i.test(message);
}

function asksForExecution(message: string): boolean {
  return /\b(send|publish|deploy|delete|commit|push|transfer|buy|sell|trade|email|call|text)\b/i.test(message);
}

export async function getZedVoiceMemory(): Promise<ZedVoiceMemory> {
  const existing = await MemoryService.getCoreMemory(ZED_VOICE_MEMORY_KEY);
  const memory = normalizeVoiceMemory(safeJsonParse<Partial<ZedVoiceMemory>>(existing?.value));

  if (!existing) {
    await saveZedVoiceMemory(memory, "Seeded ZED canonical voice memory");
  }

  return memory;
}

export async function saveZedVoiceMemory(memory: Partial<ZedVoiceMemory>, description = "ZED canonical voice memory"): Promise<ZedVoiceMemory> {
  const normalized = normalizeVoiceMemory({ ...memory, lastUpdated: nowIso() });
  await MemoryService.setCoreMemory({
    key: ZED_VOICE_MEMORY_KEY,
    value: JSON.stringify(normalized, null, 2),
    description,
    adminOnly: true,
  });
  return normalized;
}

export async function buildZedVoicePrompt(params: { mode?: ZedVoiceMode } = {}): Promise<string> {
  const memory = await getZedVoiceMemory();
  const mode = params.mode || "chat";

  return [
    "## ZED Voice Memory",
    "ZED's voice is generated from canonical Voice Memory. Do not imitate the user. Use this memory to keep ZED stable through learned operating rules.",
    "Never use canned response templates. Never add phrases like Next move, Recommended Action, Confidence Level, Research Brief, Findings, or placeholder text like (no response).",
    "### Voice principles",
    list(memory.voicePrinciples),
    "### Rejected language",
    list(memory.rejectedPhrases, 18),
    "### Domain language",
    list(memory.domainLanguage, 14),
    "### Product philosophy",
    list(memory.productPhilosophy),
    "### Tone preferences",
    list(memory.tonePreferences),
    "### Response patterns that worked",
    list(memory.responsePatternsWorked),
    "### Response patterns that failed",
    list(memory.responsePatternsFailed),
    "### Communication rules",
    list(memory.domainCommunicationRules, 12),
    "### Context behavior",
    list(memory.contextBehavior, 10),
    `Active voice mode: ${mode}.`,
  ].join("\n");
}

export async function ingestZedVoiceCorrection(params: {
  userId: string;
  conversationId?: string;
  userMessage: string;
  previousAssistantContent?: string;
}): Promise<ZedVoiceMemory | null> {
  const correction = String(params.userMessage || "").trim();
  if (!correction || !isLikelyVoiceCorrection(correction)) return null;

  const memory = await getZedVoiceMemory();
  const quoted = extractQuotedPhrases(correction);
  const rejected = [
    ...extractAfter(correction, [
      /\b(?:do not|don't|stop|avoid)\s+(?:saying|using)?\s*:?[\s"'`]*([^"'`\n]{2,140})/i,
      /\brejected\s+(?:wording|phrase|phrasing|language)\s*:?[\s"'`]*([^"'`\n]{2,140})/i,
    ]),
    ...quoted.filter(() => /\b(do not|don't|stop|avoid|rejected)\b/i.test(correction)),
  ];
  const approved = [
    ...extractAfter(correction, [
      /\b(?:say|use|write)\s+(?:this|it)?\s*(?:instead|from now on)?\s*:?[\s"'`]*([^"'`\n]{2,140})/i,
      /\bapproved\s+(?:wording|phrase|phrasing|language)\s*:?[\s"'`]*([^"'`\n]{2,140})/i,
      /\binstead\s+(?:say|use|write)\s*:?[\s"'`]*([^"'`\n]{2,140})/i,
    ]),
  ];
  const inferredRules = correctionRules(correction);
  const source = `correction:${params.userId}`;

  memory.approvedPhrases = uniqueEntries([
    ...approved.map((value) => entry(value, source, 0.86)),
    ...memory.approvedPhrases,
  ]);
  memory.rejectedPhrases = uniqueEntries([
    ...rejected.map((value) => entry(value, source, 0.86)),
    ...memory.rejectedPhrases,
  ]);
  memory.domainCommunicationRules = uniqueEntries([
    ...inferredRules.map((value) => entry(value, source, 0.82)),
    ...memory.domainCommunicationRules,
  ]);
  memory.responsePatternsFailed = uniqueEntries([
    ...inferredRules.map((value) => entry(value, source, 0.82)),
    ...memory.responsePatternsFailed,
  ]);
  memory.correctionHistory = [
    ...memory.correctionHistory,
    {
      timestamp: nowIso(),
      userId: params.userId,
      conversationId: params.conversationId,
      correction: correction.slice(0, 700),
      previousAssistantExcerpt: params.previousAssistantContent?.replace(/\s+/g, " ").trim().slice(0, 500),
      approvedPhrases: approved,
      rejectedPhrases: rejected,
      inferredRules,
    },
  ].slice(-100);
  memory.confidence = clampConfidence(memory.confidence + 0.03);

  return saveZedVoiceMemory(memory, "Updated from user correction to ZED wording, tone, framing, or assumptions");
}

export async function presentZedResponse(
  draft: string,
  options: {
    userMessage: string;
    mode?: ZedVoiceMode;
    includeSources?: boolean;
    allowProcessSummary?: boolean;
    grounded?: boolean;
  },
): Promise<string> {
  return (await presentZedResponseWithChecks(draft, options)).content;
}

export async function presentZedResponseWithChecks(
  draft: string,
  options: {
    userMessage: string;
    mode?: ZedVoiceMode;
    includeSources?: boolean;
    allowProcessSummary?: boolean;
    grounded?: boolean;
  },
): Promise<ZedPresentationResult> {
  const memory = await getZedVoiceMemory();
  const includeSources = options.includeSources ?? userRequestedSourceLinks(options.userMessage);
  const adjustments: string[] = [];

  let content = governZedResponse(draft || "", {
    userMessage: options.userMessage,
    includeSources,
    allowProcessSummary: options.allowProcessSummary,
  });

  const beforeLeakage = content;
  content = removeLeakage(content);
  if (content !== beforeLeakage) adjustments.push("removed_internal_leakage");

  const beforeRejected = content;
  content = removeRejectedLanguage(content, memory);
  if (content !== beforeRejected) adjustments.push("removed_rejected_language");

  const beforeCanned = content;
  content = removeCannedResponseLanguage(content);
  if (content !== beforeCanned) adjustments.push("removed_canned_response_language");

  if (hasRoboticHeading(content)) {
    content = content.replace(/^#{1,4}\s*(Executive Summary|Key Findings|Findings|Recommended Action|Confidence|Analysis Results|Final Assessment|Research Brief)\s*:?\s*/gim, "");
    adjustments.push("softened_robotic_heading");
  }

  const shouldAskBeforeAnswering =
    asksForExecution(options.userMessage) &&
    /\b(done|sent|published|deployed|deleted|committed|pushed|bought|sold|executed)\b/i.test(content) &&
    !/\b(confirm|approve|permission|before I)\b/i.test(content);

  if (shouldAskBeforeAnswering) {
    content = "I need explicit approval before taking that action. Confirm the exact target and scope.";
    adjustments.push("blocked_unapproved_execution_claim");
  }

  content = content.replace(/\n{3,}/g, "\n\n").trim();
  if (!content) {
    adjustments.push("empty_response_detected");
  }

  return {
    content,
    adjustments,
    checks: {
      accurate: !/\bmade that up\b/i.test(content),
      grounded: options.grounded !== false,
      properVoice: !hasRoboticHeading(content),
      internalLeakFree: content === removeLeakage(content),
      shouldAskBeforeAnswering,
      mobileUseful: isMobileUseful(content),
      conciseUnlessDepthRequested: wantsDepth(options.userMessage) || content.trim().split(/\s+/).filter(Boolean).length <= 650,
    },
  };
}
