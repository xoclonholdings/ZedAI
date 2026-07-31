import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR, HUB_USER_MEMORY_DIR } from "../utils/repoPaths";

const WORKING_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");
const EPISODIC_MEMORY = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/email-decisions.json");
const APPROVAL_QUEUE = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/approval-queue.json");
const CONSENSUS = path.resolve(HUB_SHARED_MEMORY_DIR, "consensus/posting-guidelines.md");

const MAX_WORKING_CHARS = 1200;
const MAX_EPISODIC_ENTRIES = 5;
const MAX_CONSENSUS_CHARS = 800;
const MAX_FOUNDATION_CHARS = 1000;

export interface InjectedMemory {
  working: string;
  episodic: string;
  consensus: string;
  foundation: string;
  formatted: string;
}

type InjectMemoryOptions = {
  includeFoundation?: boolean;
  userId?: string;
};

const INVALID_MEMORY_USER_IDS = new Set([
  "",
  "user",
  "user_001",
  "default-user",
  "default_user",
  "anonymous",
  "unknown",
  "offline",
  "admin-user",
  "admin_user",
]);

function requireMemoryUserId(value: unknown, operation: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${operation} requires an authenticated userId.`);
  }
  const userId = value.trim();
  if (
    INVALID_MEMORY_USER_IDS.has(userId) ||
    userId.includes("..") ||
    userId.includes("/") ||
    userId.includes("\\")
  ) {
    throw new Error(`${operation} received an invalid or fallback userId.`);
  }
  return userId;
}

function safeUserId(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) throw new Error("Authenticated userId could not be converted to a scoped memory path.");
  return safe;
}

async function loadWorking(): Promise<string> {
  try {
    const raw = await fs.readFile(WORKING_MEMORY, "utf-8");
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "# Working Memory — Active Tasks\n*ZAR Operations Agent — Working Context*\n\n<!-- This file is updated by OperationsAgent during each session -->\n<!-- Format: ## [ISO timestamp] User: [userId] -->\n\n## Session Initialized\nSystem ready. No active tasks.") {
      return "No active tasks recorded yet.";
    }
    return trimmed.slice(-MAX_WORKING_CHARS);
  } catch {
    return "Working memory not yet initialized.";
  }
}

async function loadEpisodic(): Promise<string> {
  try {
    const lines: string[] = [];

    try {
      const raw = await fs.readFile(EPISODIC_MEMORY, "utf-8");
      const data = JSON.parse(raw);
      const entries = (data.entries || []).slice(-MAX_EPISODIC_ENTRIES);
      for (const e of entries) {
        lines.push(`[${e.timestamp?.slice(0, 10) ?? "?"}] ${e.message} → ${e.outcome ?? "unknown"}`);
      }
    } catch {}

    try {
      const raw = await fs.readFile(APPROVAL_QUEUE, "utf-8");
      const data = JSON.parse(raw);
      const pending = (data.entries || []).filter((e: any) => e.status === "pending");
      if (pending.length > 0) {
        lines.push(`PENDING APPROVALS (${pending.length}): ${pending.slice(0, 3).map((e: any) => e.message?.slice(0, 60)).join(" | ")}`);
      }
    } catch {}

    return lines.length > 0 ? lines.join("\n") : "No recent decisions or pending approvals.";
  } catch {
    return "Episodic memory not yet initialized.";
  }
}

async function loadConsensus(): Promise<string> {
  try {
    const raw = await fs.readFile(CONSENSUS, "utf-8");
    return raw.trim().slice(0, MAX_CONSENSUS_CHARS);
  } catch {
    return "Be professional, direct, and brand-aligned.";
  }
}

async function loadFoundation(userId?: string): Promise<string> {
  const owner = requireMemoryUserId(userId, "foundation memory injection");
  const candidate = path.resolve(
    HUB_USER_MEMORY_DIR,
    safeUserId(owner),
    "foundation/consensus/foundation-overview.md",
  );

  try {
    const raw = await fs.readFile(candidate, "utf-8");
    const trimmed = raw.trim();
    if (trimmed) return trimmed.slice(0, MAX_FOUNDATION_CHARS);
  } catch {
    /* No scoped foundation summary exists yet. */
  }

  return "No imported foundation memory summary exists for this user scope.";
}

export async function injectMemory(agentName: string, options?: InjectMemoryOptions): Promise<InjectedMemory> {
  const includeFoundation = options?.includeFoundation === true;
  const [working, episodic, consensus, foundation] = await Promise.all([
    loadWorking(),
    loadEpisodic(),
    loadConsensus(),
    includeFoundation ? loadFoundation(options?.userId) : Promise.resolve("Admin-only foundation memory is not included in this context."),
  ]);

  const formatted = `## ZAR Hub Memory Context
**Agent**: ${agentName}

### Active Priorities (Working Memory)
${working}

### Recent Decisions & Pending Approvals (Episodic)
${episodic}

### Brand Voice & Guidelines (Consensus)
${consensus}

${includeFoundation ? `### Imported Foundation Memory\n${foundation}` : "### Imported Foundation Memory\nNot included for this user scope."}`;

  return { working, episodic, consensus, foundation, formatted };
}
