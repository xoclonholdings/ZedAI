import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

import { KnowledgeIngestionService } from "../services/knowledge-ingestion/KnowledgeIngestionService";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";
import type { IngestionReport, RawKnowledgeInput } from "../services/knowledge-ingestion/types";

type FoundationMessage = {
  role?: string;
  text?: string;
  createTime?: string;
};

type FoundationConversation = {
  canonicalKey?: string;
  conversationId?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  sources?: string[];
  sourceConversationIds?: string[];
  participants?: string[];
  messageCount?: number;
  preview?: string;
  fingerprint?: string;
  messages?: FoundationMessage[];
};

type CliOptions = {
  apply: boolean;
  limit?: number;
  offset: number;
  query?: string;
};

type ProcessedItem = {
  conversationId: string;
  canonicalKey: string;
  title: string;
  status: "processed" | "skipped" | "failed";
  mode: "dry-run" | "apply";
  importId?: string;
  sourceId?: string;
  alreadyImported?: boolean;
  metadataBackfilled?: boolean;
  candidateObjects: number;
  decisions: number;
  relationships: number;
  conflicts: number;
  openQuestions: number;
  error?: string;
};

type PromotionCandidate = {
  id: string;
  name: string;
  type: string;
  confidence: number;
  temporalStatus: string;
  sourceName: string;
  reason: string;
};

const FOUNDATION_CONVERSATIONS_PATH = path.join(
  HUB_SHARED_MEMORY_DIR,
  "semantic/foundation/merged-conversations.json",
);
const OUTPUT_DIR = path.join(HUB_SHARED_MEMORY_DIR, "foundation-reparse");
const BACKUP_DIR = path.join(OUTPUT_DIR, "backups");
const GRAPH_PATH = path.join(HUB_SHARED_MEMORY_DIR, "knowledge-graph/knowledge-graph.json");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false, offset: 0 };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--limit") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 1) throw new Error("--limit must be a positive number");
      options.limit = Math.floor(value);
      index += 1;
    } else if (arg === "--offset") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value < 0) throw new Error("--offset must be zero or a positive number");
      options.offset = Math.floor(value);
      index += 1;
    } else if (arg === "--query") {
      const value = argv[index + 1];
      if (!value?.trim()) throw new Error("--query requires a value");
      options.query = value.trim();
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function stableHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function safeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMessageText(value: string): string {
  return value
    .replace(/\uE200[\s\S]*?\uE201/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function roleLabel(role?: string): string {
  const normalized = String(role || "unknown").toLowerCase();
  if (normalized === "user") return "User";
  if (normalized === "assistant") return "Assistant";
  if (normalized === "system") return "System";
  if (normalized === "tool") return "Tool";
  return "Other";
}

function conversationText(conversation: FoundationConversation): string {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const body = messages
    .map((message) => {
      const text = cleanMessageText(String(message.text || ""));
      if (!text) return "";
      return `${roleLabel(message.role)}:\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return (body || conversation.preview || "").trim();
}

function conversationMatches(conversation: FoundationConversation, query?: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    conversation.title,
    conversation.preview,
    conversation.canonicalKey,
    conversation.conversationId,
    ...(conversation.messages || []).map((message) => message.text || ""),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

function importIdFor(conversation: FoundationConversation): string {
  const key = conversation.conversationId || conversation.canonicalKey || conversation.fingerprint || conversation.title || "unknown";
  return `foundation-reparse-${stableHash(key)}`;
}

function toRawKnowledgeInput(conversation: FoundationConversation, options: CliOptions): RawKnowledgeInput {
  const conversationId = conversation.conversationId || conversation.canonicalKey || conversation.fingerprint || "unknown";
  return {
    sourceName: conversation.title || conversation.canonicalKey || "Foundation Conversation",
    sourceUri: `foundation:${conversationId}`,
    contentType: "conversation",
    content: conversationText(conversation),
    author: "foundation import",
    createdAt: conversation.createdAt || conversation.updatedAt,
    metadata: {
      importId: importIdFor(conversation),
      conversationId,
      canonicalKey: conversation.canonicalKey || conversationId,
      messageCount: conversation.messageCount || conversation.messages?.length || 0,
      source: "foundation-reparse",
      mode: options.apply ? "apply" : "dry-run",
      dryRun: !options.apply,
      classificationPolicy: {
        historicalTranscript: true,
        userMessagesStrongerThanAssistantMessages: true,
        assistantMessagesAreProposalsUntilConfirmed: true,
        doNotAssumeCurrentTruthWithoutTranscriptEvidence: true,
      },
      sources: conversation.sources || [],
      sourceConversationIds: conversation.sourceConversationIds || [],
    },
  };
}

async function readConversations(): Promise<FoundationConversation[]> {
  const raw = await fs.readFile(FOUNDATION_CONVERSATIONS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("merged-conversations.json must be an array");
  return parsed;
}

async function snapshotGraphIfApplying(apply: boolean): Promise<string | null> {
  if (!apply) return null;
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `knowledge-graph.${timestamp}.json`);

  try {
    await fs.copyFile(GRAPH_PATH, backupPath);
  } catch {
    await fs.writeFile(
      backupPath,
      JSON.stringify({ note: "No existing knowledge graph was present before apply mode.", createdAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  }

  return backupPath;
}

function collectPromotionCandidates(reports: IngestionReport[]): PromotionCandidate[] {
  const candidates = new Map<string, PromotionCandidate>();

  for (const report of reports) {
    for (const object of report.extractedObjects) {
      const decisionLike = object.type === "decision" || object.tags.some((tag) => /decision|approved|canonical|current/i.test(tag));
      const strongCandidate = object.confidence >= 0.72 || object.importance >= 0.72 || decisionLike;
      if (!strongCandidate || object.status === "confirmed") continue;
      candidates.set(object.id, {
        id: object.id,
        name: object.name,
        type: object.type,
        confidence: object.confidence,
        temporalStatus: object.temporalStatus,
        sourceName: object.source.sourceName,
        reason: decisionLike
          ? "Decision-like or current-truth language needs user review before promotion."
          : "High-confidence candidate extracted from foundation memory.",
      });
    }
  }

  return Array.from(candidates.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 100);
}

function topProjects(reports: IngestionReport[]): Array<{ name: string; count: number; confidence: number }> {
  const counts = new Map<string, { count: number; confidence: number }>();
  for (const report of reports) {
    for (const object of report.extractedObjects) {
      if (!["project", "application", "company", "product", "concept", "goal"].includes(object.type)) continue;
      const name = safeText(object.name);
      if (!name || name.length < 2) continue;
      const current = counts.get(name) || { count: 0, confidence: 0 };
      counts.set(name, {
        count: current.count + 1,
        confidence: Math.max(current.confidence, object.confidence),
      });
    }
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.count - a.count || b.confidence - a.confidence)
    .slice(0, 25);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

async function writeOutputs(params: {
  options: CliOptions;
  startedAt: string;
  completedAt: string;
  totalFound: number;
  selectedCount: number;
  backupPath: string | null;
  processed: ProcessedItem[];
  reports: IngestionReport[];
}) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allObjects = params.reports.flatMap((report) => report.extractedObjects);
  const allDecisions = params.reports.flatMap((report) => report.detectedDecisions);
  const allConflicts = uniqueById(params.reports.flatMap((report) => report.detectedConflicts));
  const allQuestions = uniqueById(params.reports.flatMap((report) => report.openQuestions));
  const promotionCandidates = collectPromotionCandidates(params.reports);
  const skipped = params.processed.filter((item) => item.status === "skipped").length;
  const failed = params.processed.filter((item) => item.status === "failed").length;

  const manifest = {
    runId: `foundation-reparse-${stableHash(`${params.startedAt}:${JSON.stringify(params.options)}`)}`,
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    mode: params.options.apply ? "apply" : "dry-run",
    query: params.options.query || null,
    limit: params.options.limit || null,
    offset: params.options.offset,
    sourcePath: FOUNDATION_CONVERSATIONS_PATH,
    outputDir: OUTPUT_DIR,
    graphPath: GRAPH_PATH,
    backupPath: params.backupPath,
    rollback:
      params.backupPath && params.options.apply
        ? `Restore ${params.backupPath} over ${GRAPH_PATH} to roll back this apply run.`
        : "Dry-run created no graph mutation. No rollback needed.",
  };

  const summary = {
    ...manifest,
    totals: {
      conversationsFound: params.totalFound,
      conversationsSelected: params.selectedCount,
      conversationsProcessed: params.processed.filter((item) => item.status === "processed").length,
      conversationsSkipped: skipped,
      conversationsFailed: failed,
      candidateObjects: allObjects.length,
      decisions: allDecisions.length,
      relationships: params.reports.reduce((sum, report) => sum + report.relationshipMap.length, 0),
      conflicts: allConflicts.length,
      openQuestions: allQuestions.length,
    },
    topProjectsDetected: topProjects(params.reports),
    topPromotionCandidates: promotionCandidates.slice(0, 20),
    unresolvedItemsNeedingUserConfirmation: allQuestions.slice(0, 50),
    processed: params.processed,
  };

  const runReportName = params.options.apply ? "apply-report.json" : "dry-run-report.json";

  await Promise.all([
    fs.writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, runReportName), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, "latest-report.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, "promotion-candidates.json"), `${JSON.stringify(promotionCandidates, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, "conflicts.json"), `${JSON.stringify(allConflicts, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(OUTPUT_DIR, "unresolved-questions.json"), `${JSON.stringify(allQuestions, null, 2)}\n`, "utf8"),
    fs.appendFile(path.join(OUTPUT_DIR, "reparse-history.jsonl"), `${JSON.stringify(summary)}\n`, "utf8"),
  ]);

  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const conversations = await readConversations();
  const matching = conversations.filter((conversation) => conversationMatches(conversation, options.query));
  const selected = matching.slice(options.offset, options.limit ? options.offset + options.limit : undefined);
  let backupPath: string | null = null;
  const processed: ProcessedItem[] = [];
  const reports: IngestionReport[] = [];

  for (const conversation of selected) {
    const conversationId = conversation.conversationId || conversation.canonicalKey || conversation.fingerprint || "unknown";
    const canonicalKey = conversation.canonicalKey || conversationId;
    const title = conversation.title || canonicalKey;
    const input = toRawKnowledgeInput(conversation, options);

    try {
      const importStatus = await KnowledgeIngestionService.getImportStatus(input);
      if (importStatus.alreadyImported) {
        let metadataBackfilled = false;
        if (options.apply) {
          if (!backupPath) {
            backupPath = await snapshotGraphIfApplying(true);
          }
          metadataBackfilled = await KnowledgeIngestionService.backfillImportMetadata(input);
        }
        processed.push({
          conversationId,
          canonicalKey,
          title,
          status: "skipped",
          mode: options.apply ? "apply" : "dry-run",
          importId: importStatus.importId,
          sourceId: importStatus.sourceId,
          alreadyImported: true,
          metadataBackfilled,
          candidateObjects: 0,
          decisions: 0,
          relationships: 0,
          conflicts: 0,
          openQuestions: 0,
        });
        continue;
      }

      if (options.apply && !backupPath) {
        backupPath = await snapshotGraphIfApplying(true);
      }

      const report = options.apply
        ? await KnowledgeIngestionService.ingest(input)
        : await KnowledgeIngestionService.preview(input);
      reports.push(report);
      processed.push({
        conversationId,
        canonicalKey,
        title,
        status: "processed",
        mode: options.apply ? "apply" : "dry-run",
        importId: report.importId,
        sourceId: report.sourceAnalysis.sourceId,
        alreadyImported: false,
        candidateObjects: report.extractedObjects.length,
        decisions: report.detectedDecisions.length,
        relationships: report.relationshipMap.length,
        conflicts: report.detectedConflicts.length,
        openQuestions: report.openQuestions.length,
      });
    } catch (error) {
      processed.push({
        conversationId,
        canonicalKey,
        title,
        status: "failed",
        mode: options.apply ? "apply" : "dry-run",
        candidateObjects: 0,
        decisions: 0,
        relationships: 0,
        conflicts: 0,
        openQuestions: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = await writeOutputs({
    options,
    startedAt,
    completedAt: new Date().toISOString(),
    totalFound: conversations.length,
    selectedCount: selected.length,
    backupPath,
    processed,
    reports,
  });

  console.log(JSON.stringify(summary.totals, null, 2));
  console.log(`Report: ${path.join(OUTPUT_DIR, options.apply ? "apply-report.json" : "dry-run-report.json")}`);
  if (backupPath) console.log(`Backup: ${backupPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
