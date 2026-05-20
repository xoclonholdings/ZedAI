import fs from "fs/promises";
import path from "path";

import { HUB_LOG_DIR } from "../../utils/repoPaths";

import type { AgentName, OrchestratorRequest } from "./types";

const LOG_DIR = HUB_LOG_DIR;

/**
 * Append-only daily routing log — one line per dispatched message,
 * keyed by date so log files don't grow unbounded. Failures here are
 * intentionally swallowed: if disk is full or perms are wrong, we
 * don't want to take down the request path with it. The runtime
 * logger captures the real ones via logRuntimeEvent elsewhere.
 */
export async function logRouting(
  request: OrchestratorRequest,
  agent: AgentName,
): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(LOG_DIR, `routing-${date}.log`);
    const entry =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        agent,
        messageLength: request.message.length,
        conversationId: request.conversationId,
      }) + "\n";
    await fs.appendFile(logFile, entry);
  } catch {
    // see jsdoc above — intentionally swallowed
  }
}
