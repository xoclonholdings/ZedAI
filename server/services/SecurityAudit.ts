import fs from "fs/promises";
import path from "path";

const CWD = process.cwd();
const LOG_DIR = path.resolve(CWD, "hub/logs");
const SECURITY_LOG = path.resolve(LOG_DIR, "security.log");

export type SecurityEventType =
  | "auth.login.success"
  | "auth.login.fail"
  | "auth.logout"
  | "auth.lockout"
  | "auth.session_expired"
  | "approval.queued"
  | "approval.approved"
  | "approval.rejected"
  | "tier.violation"
  | "tier.block";

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  ip?: string;
  userId?: string;
  detail?: string;
  tier?: number;
}

async function ensureLogDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

export async function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): Promise<void> {
  try {
    await ensureLogDir();
    const entry: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(SECURITY_LOG, line);
    console.log(`[SecurityAudit] ${entry.type} — ${entry.detail ?? ""}`);
  } catch (err) {
    console.warn("[SecurityAudit] Failed to write security log:", err);
  }
}

export async function getRecentSecurityEvents(limit = 50): Promise<SecurityEvent[]> {
  try {
    const raw = await fs.readFile(SECURITY_LOG, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean) as SecurityEvent[];
  } catch {
    return [];
  }
}
