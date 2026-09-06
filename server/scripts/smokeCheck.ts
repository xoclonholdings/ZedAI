import fs from "fs/promises";

import { loadAdminSettings } from "../services/AdminSettingsStore";
import { HUB_DIR, REPO_ROOT } from "../utils/repoPaths";

async function main() {
  const settings = await loadAdminSettings();
  const hubStats = await fs.stat(HUB_DIR);
  const rootStats = await fs.stat(REPO_ROOT);

  if (!hubStats.isDirectory()) {
    throw new Error("Hub directory is not available at the repo root");
  }

  if (!rootStats.isDirectory()) {
    throw new Error("Repo root could not be resolved");
  }

  const admin = settings.users.find((user) => user.isAdmin);
  if (!admin) {
    throw new Error("Admin user is missing from admin settings");
  }

  const operator = settings.agents.find((agent) => agent.key === "ZAR");
  if (!operator || operator.status !== "active") {
    throw new Error("ZAR operator is missing or not marked as active");
  }
  if (settings.agents.some((agent) => agent.key !== "ZAR")) {
    throw new Error("Legacy lane agents were reactivated in public settings");
  }

  if (!settings.integrations.gusto) {
    throw new Error("Gusto integration settings are missing");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        repoRoot: REPO_ROOT,
        hubDir: HUB_DIR,
        adminOwnerId: admin.id,
        adminFallbackConfigured: Boolean(settings.auth.securePhrase),
        operatorStatus: operator.status,
        publicOperatorCount: settings.agents.length,
        gustoIntegrationStatus: settings.integrations.gusto.status,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[smokeCheck] failed:", error);
  process.exit(1);
});
