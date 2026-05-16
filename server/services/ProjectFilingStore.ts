import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_CONFIG_DIR } from "../utils/repoPaths";

export interface ProjectSource {
  id: string;
  /** A short label the user gives the source ("Brand voice doc"). */
  label: string;
  /** Either an uploaded file URL (/uploads/...) OR a raw URL pasted by the user. */
  url?: string;
  /** Optional pasted text — for short snippets that don't need a file. */
  text?: string;
  /** Free-form note shown alongside the source in the UI. */
  notes?: string;
  /** ISO timestamp of when it was added. */
  addedAt: string;
}

export interface FilingProject {
  id: string;
  userId: string;
  name: string;
  color: string;
  conversationIds: string[];
  /** Per-project system prompt — gets injected into agent context when
   *  a conversation is filed under this project. */
  instructions?: string;
  /** Files / URLs / snippets the project wants the agents to reference. */
  sources?: ProjectSource[];
  createdAt: string;
  updatedAt: string;
}

type FilingState = {
  version: string;
  projects: FilingProject[];
};

const PROJECTS_PATH = path.join(HUB_CONFIG_DIR, "projects.json");
const DEFAULT_COLORS = ["#c026d3", "#7c3aed", "#2563eb", "#0891b2", "#059669", "#ea580c"];

async function readState(): Promise<FilingState> {
  try {
    const raw = await fs.readFile(PROJECTS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as FilingState;
    return {
      version: parsed.version || "1.0",
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { version: "1.0", projects: [] };
  }
}

async function writeState(state: FilingState) {
  await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
  await fs.writeFile(PROJECTS_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function normalizeName(name: string) {
  return name.trim().slice(0, 60);
}

export async function listProjects(userId: string) {
  const state = await readState();
  return state.projects.filter((project) => project.userId === userId);
}

export async function createProject(userId: string, name: string) {
  const trimmedName = normalizeName(name);
  if (!trimmedName) {
    throw new Error("Project name is required");
  }

  const state = await readState();
  if (state.projects.some((project) => project.userId === userId && project.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error("A project with that name already exists");
  }

  const timestamp = new Date().toISOString();
  const userProjects = state.projects.filter((project) => project.userId === userId);
  const project: FilingProject = {
    id: randomUUID(),
    userId,
    name: trimmedName,
    color: DEFAULT_COLORS[userProjects.length % DEFAULT_COLORS.length],
    conversationIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.projects.push(project);
  await writeState(state);
  return project;
}

export async function getProject(userId: string, projectId: string) {
  const state = await readState();
  return state.projects.find(
    (project) => project.userId === userId && project.id === projectId,
  );
}

export async function updateProjectInstructions(
  userId: string,
  projectId: string,
  instructions: string,
) {
  const state = await readState();
  const project = state.projects.find(
    (p) => p.userId === userId && p.id === projectId,
  );
  if (!project) throw new Error("Project not found");
  project.instructions = (instructions || "").slice(0, 8000);
  project.updatedAt = new Date().toISOString();
  await writeState(state);
  return project;
}

export async function addProjectSource(
  userId: string,
  projectId: string,
  source: Omit<ProjectSource, "id" | "addedAt">,
) {
  const state = await readState();
  const project = state.projects.find(
    (p) => p.userId === userId && p.id === projectId,
  );
  if (!project) throw new Error("Project not found");
  if (!source.label?.trim()) throw new Error("Source label is required");
  if (!source.url && !source.text) {
    throw new Error("Source must have either a url or text");
  }
  const entry: ProjectSource = {
    id: randomUUID(),
    label: source.label.trim().slice(0, 80),
    url: source.url || undefined,
    text: source.text ? source.text.slice(0, 16000) : undefined,
    notes: source.notes ? source.notes.slice(0, 500) : undefined,
    addedAt: new Date().toISOString(),
  };
  project.sources = [...(project.sources || []), entry];
  project.updatedAt = entry.addedAt;
  await writeState(state);
  return entry;
}

export async function removeProjectSource(
  userId: string,
  projectId: string,
  sourceId: string,
) {
  const state = await readState();
  const project = state.projects.find(
    (p) => p.userId === userId && p.id === projectId,
  );
  if (!project) throw new Error("Project not found");
  project.sources = (project.sources || []).filter((s) => s.id !== sourceId);
  project.updatedAt = new Date().toISOString();
  await writeState(state);
  return project;
}

export async function assignConversationToProject(userId: string, conversationId: string, projectId?: string | null) {
  const state = await readState();
  const now = new Date().toISOString();

  let foundTarget = !projectId;
  for (const project of state.projects) {
    if (project.userId !== userId) continue;
    project.conversationIds = project.conversationIds.filter((id) => id !== conversationId);

    if (projectId && project.id === projectId) {
      project.conversationIds.push(conversationId);
      project.updatedAt = now;
      foundTarget = true;
    }
  }

  if (!foundTarget) {
    throw new Error("Project not found");
  }

  await writeState(state);
  return state.projects.filter((project) => project.userId === userId);
}

