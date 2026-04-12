import fs from "fs/promises";
import path from "path";
import { HUB_LOG_DIR } from "../utils/repoPaths";

export type RuntimeLogLevel = "info" | "warn" | "error";
export type RuntimeLogSource = "server" | "client";

export interface RuntimeLogEntry {
  timestamp: string;
  level: RuntimeLogLevel;
  source: RuntimeLogSource;
  event: string;
  detail?: string;
  context?: Record<string, unknown>;
}

const RUNTIME_LOG = path.resolve(HUB_LOG_DIR, "runtime.log");

async function ensureDir() {
  await fs.mkdir(HUB_LOG_DIR, { recursive: true });
}

export async function logRuntimeEvent(entry: Omit<RuntimeLogEntry, "timestamp">) {
  try {
    await ensureDir();
    const payload: RuntimeLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    await fs.appendFile(RUNTIME_LOG, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    console.warn("[RuntimeLogger] Failed to write runtime log:", error);
  }
}

export async function getRecentRuntimeEvents(limit = 150): Promise<RuntimeLogEntry[]> {
  try {
    const raw = await fs.readFile(RUNTIME_LOG, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line) as RuntimeLogEntry;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as RuntimeLogEntry[];
  } catch {
    return [];
  }
}
