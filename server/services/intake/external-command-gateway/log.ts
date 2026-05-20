import fs from "fs/promises";
import path from "path";

import { COMMAND_LOG_PATH, type CommandLogFile } from "./types";

/**
 * Append-only persistent log of every external command we received.
 * Disk failures are warned, not thrown, because losing one log
 * entry shouldn't break command intake — the runtime logger still
 * captures the event independently.
 */
export async function logCommand(
  entry: CommandLogFile["entries"][number],
): Promise<void> {
  try {
    let file: CommandLogFile = { version: "1.0", entries: [] };
    try {
      const raw = await fs.readFile(COMMAND_LOG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) file = parsed;
    } catch {
      // File doesn't exist yet (first command on this deploy) or is
      // malformed — fall through with the empty file we set above.
    }
    file.entries.push(entry);
    await fs.mkdir(path.dirname(COMMAND_LOG_PATH), { recursive: true });
    await fs.writeFile(COMMAND_LOG_PATH, JSON.stringify(file, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ExternalCommandGateway] Failed to write command log:", err);
  }
}

/** Read the most recent commands, newest first. Used by ops tooling. */
export async function listRecentCommands(limit = 100): Promise<CommandLogFile["entries"]> {
  try {
    const raw = await fs.readFile(COMMAND_LOG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      return (parsed.entries as CommandLogFile["entries"]).slice(-limit).reverse();
    }
  } catch {
    // No log yet, or unreadable → return empty list rather than throwing.
  }
  return [];
}
