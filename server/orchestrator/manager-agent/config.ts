import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { HUB_CONFIG_DIR } from "../../utils/repoPaths";

import type { HubConfig } from "./types";

const CONFIG_DIR = HUB_CONFIG_DIR;

/**
 * Cached, lazily-loaded view of the four ruleset YAMLs that the
 * manager (and downstream agents) read on every request. Cache is
 * cleared by flushHubConfig() whenever the admin edits a rules file.
 */
let cached: HubConfig | null = null;

export async function loadHubConfig(): Promise<HubConfig> {
  if (cached) return cached;

  const loadYaml = async (filename: string) => {
    try {
      const raw = await fs.readFile(path.join(CONFIG_DIR, filename), "utf-8");
      return yaml.load(raw) as any;
    } catch {
      // A missing or unparseable ruleset file shouldn't take the
      // orchestrator down — fall back to an empty object and let the
      // keyword classifier use its built-in defaults.
      console.warn(`[ManagerAgent] Could not load ${filename}, using defaults`);
      return {};
    }
  };

  cached = {
    personality: await loadYaml("personality.yaml"),
    security: await loadYaml("security.yaml"),
    parameters: await loadYaml("parameters.yaml"),
    access: await loadYaml("access.yaml"),
  };

  return cached;
}

export function flushHubConfig(): void {
  cached = null;
  console.log(
    "[ManagerAgent] Config cache flushed; will reload from disk on next request",
  );
}
