import { randomUUID } from "crypto";

import type { WorkspaceDeskEntry, WorkspaceDeskSection } from "../../../shared/workspace-desk-types";
import { WORKSPACE_DESK_SPECS } from "../../../shared/workspace-desk-types";
import { generateChatFromProvider } from "../ModelProviderService";
import { buildWorkspaceMemoryContext } from "../WorkspaceMemoryService";
import { readAppState, writeAppState } from "../appState";

/**
 * The engine behind each workspace desk (Education / Operations /
 * Marketing). It ALWAYS runs through the workspace's own memory first,
 * then asks the model to fill a domain-specific structured entry, and
 * saves it durably so the desk fills up over time.
 *
 * Honesty: entries are drafts grounded in workspace memory + the user's
 * sources + ZAR's knowledge — never fabricated metrics or citations.
 */

const MAX_ENTRIES = 100;

function scopeFor(workspace: string): string {
  return `desk:${workspace}`;
}

function toStringArray(value: unknown, limit = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : String(v ?? "")))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

export async function listDeskEntries(
  workspace: string,
  userId: string,
): Promise<WorkspaceDeskEntry[]> {
  const stored = await readAppState<WorkspaceDeskEntry[]>(scopeFor(workspace), userId);
  return Array.isArray(stored) ? stored : [];
}

export async function deleteDeskEntry(
  workspace: string,
  userId: string,
  id: string,
): Promise<WorkspaceDeskEntry[]> {
  const entries = await listDeskEntries(workspace, userId);
  const next = entries.filter((e) => e.id !== id);
  await writeAppState(scopeFor(workspace), userId, next);
  return next;
}

export interface GenerateDeskInput {
  workspace: string;
  userId: string;
  isAdmin?: boolean;
  topic: string;
  sources?: string;
}

export async function generateDeskEntry(input: GenerateDeskInput): Promise<WorkspaceDeskEntry> {
  const spec = WORKSPACE_DESK_SPECS[input.workspace];
  if (!spec) throw new Error(`No desk is defined for workspace "${input.workspace}".`);

  const topic = String(input.topic || "").trim();
  if (!topic) throw new Error("A subject is required.");

  const sourceText = String(input.sources || "").trim();
  const hasSources = sourceText.length > 0;

  // Memory-first: always ground in this workspace's own knowledge.
  const workspaceMemory = await buildWorkspaceMemoryContext(
    input.workspace,
    topic,
    input.userId,
    Boolean(input.isAdmin),
  ).catch(() => ({
    prompt: "",
    count: 0,
    used: false,
  }));

  const fieldSpec = spec.fields.map((f) => `  "${f.key}": ["${f.label}"]`).join(",\n");
  const prompt = [
    workspaceMemory.used ? `${workspaceMemory.prompt}\n` : "",
    `Subject: ${topic}`,
    hasSources
      ? `\nThe user provided these sources — ground your work in them:\n"""\n${sourceText.slice(0, 6000)}\n"""`
      : "",
    `\nProduce a working entry. Be concrete and honest — do not invent facts, metrics, or citations you can't support. Return ONLY JSON with this exact shape:`,
    `{`,
    `  "summary": "2-4 sentence orientation",`,
    `${fieldSpec}`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await generateChatFromProvider(
    [{ role: "user", content: prompt }],
    `${spec.systemRole} Output only the JSON object requested.`,
    { lane: input.workspace === "operations" ? "operations" : "business" },
  );

  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    parsed = { summary: raw.slice(0, 600) };
  }

  const sections: WorkspaceDeskSection[] = spec.fields
    .map((f) => ({ label: f.label, items: toStringArray(parsed[f.key]) }))
    .filter((s) => s.items.length > 0);

  const groundedBits = [
    workspaceMemory.used ? `${workspaceMemory.count} workspace memory item(s)` : "",
    hasSources ? "your sources" : "",
  ].filter(Boolean);
  const basis = `Draft grounded in ${
    groundedBits.length ? groundedBits.join(" + ") + " and " : ""
  }ZAR's knowledge. No live data — verify anything time-sensitive.`;

  const entry: WorkspaceDeskEntry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    workspace: input.workspace,
    topic,
    summary: String(parsed.summary || "").trim() || "No summary was produced.",
    sections,
    sources: hasSources ? [sourceText.slice(0, 4000)] : [],
    draft: true,
    basis,
  };

  const existing = await listDeskEntries(input.workspace, input.userId);
  await writeAppState(scopeFor(input.workspace), input.userId, [entry, ...existing].slice(0, MAX_ENTRIES));

  return entry;
}
