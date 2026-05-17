import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { HUB_CONFIG_DIR } from "../utils/repoPaths";
import { ManagerAgent } from "../orchestrator/ManagerAgent";

/**
 * Ruleset YAML files that drive ZED's personality / security /
 * parameters / access policy. Edited from Admin → Ruleset. After any
 * write, ManagerAgent.flushConfig() clears the in-memory cache so the
 * next call picks up the new rules.
 */
const RULESET_FILES = [
  "personality.yaml",
  "security.yaml",
  "parameters.yaml",
  "access.yaml",
] as const;

async function readYamlFile(filename: string): Promise<string> {
  try {
    return await fs.readFile(path.join(HUB_CONFIG_DIR, filename), "utf-8");
  } catch {
    return "";
  }
}

async function writeRulesetFile(filename: string, content: string): Promise<void> {
  await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
  await fs.writeFile(path.join(HUB_CONFIG_DIR, filename), content, "utf-8");
  ManagerAgent.flushConfig();
}

export function registerRulesetRoutes(app: Express): void {
  // Raw YAML view — the legacy textarea editor reads this.
  app.get("/api/admin/ruleset", isAdmin, async (_req, res) => {
    const ruleset: Record<string, string> = {};
    for (const f of RULESET_FILES) {
      ruleset[f] = await readYamlFile(f);
    }
    res.json(ruleset);
  });

  // Parsed view — the structured form editor consumes this.
  app.get("/api/admin/ruleset/structured", isAdmin, async (_req, res) => {
    const ruleset: Record<string, any> = {};
    for (const f of RULESET_FILES) {
      const raw = await readYamlFile(f);
      try {
        ruleset[f] = raw ? yaml.load(raw) || {} : {};
      } catch {
        ruleset[f] = {};
      }
    }
    res.json(ruleset);
  });

  // Raw YAML write — validates parseability before persisting.
  app.post("/api/admin/ruleset", isAdmin, async (req: any, res) => {
    const { filename, content } = req.body || {};
    if (!RULESET_FILES.includes(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    try {
      yaml.load(content);
      await writeRulesetFile(filename, content);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Structured write — serializes the JSON-shaped content back to YAML,
  // re-parses to validate, then persists.
  app.post("/api/admin/ruleset/structured", isAdmin, async (req: any, res) => {
    const { filename, content } = req.body || {};
    if (!RULESET_FILES.includes(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    try {
      const serialized = yaml.dump(content || {}, {
        noRefs: true,
        lineWidth: 120,
        sortKeys: false,
      });
      yaml.load(serialized);
      await writeRulesetFile(filename, serialized);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}
