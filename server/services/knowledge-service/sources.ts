import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { HUB_CONFIG_DIR } from "../../utils/repoPaths";

/**
 * Load the four canonical ruleset YAMLs from disk so they can be
 * rendered alongside core memory in the prompt. Files that are
 * missing or malformed are skipped silently — the orchestrator
 * tolerates an empty ruleset section, and the EnvValidator surfaces
 * real config issues at boot.
 */
export async function loadRulesetMemory(): Promise<Array<{ key: string; value: string }>> {
  const files = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
  const results: Array<{ key: string; value: string }> = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(HUB_CONFIG_DIR, file), "utf-8");
      const parsed = yaml.load(content);
      results.push({
        key: file.replace(".yaml", ""),
        value: typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2),
      });
    } catch {
      // missing or unparseable file → skip; see jsdoc above
    }
  }

  return results;
}
