import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { HUB_CONFIG_DIR } from "../utils/repoPaths";
import { loadAdminSettings } from "./AdminSettingsStore";
import { listProjects } from "./ProjectFilingStore";
import { voiceSettingsToPrompt } from "./voiceSettings";

/**
 * Builds the "live admin context" that gets injected into ZED's system
 * prompt on every chat / agent call. This is the bridge that makes the
 * admin panel actually flow into the AI — without it, settings are
 * stored but never read.
 *
 * Output is intentionally compact: a few hundred tokens at most. We
 * summarize counts and labels, not full credentials.
 */

interface BuiltContext {
  /** The text block to append to the system prompt. */
  text: string;
  /** Cheap metadata the route can return for debugging / admin preview. */
  meta: {
    rulesetFiles: string[];
    enabledIntegrations: string[];
    customIntegrations: string[];
    parametersCount: number;
    voiceApplied: boolean;
    projectInstructions?: boolean;
    projectSourceCount?: number;
  };
}

interface AdminContextOptions {
  /** When a conversation belongs to a project, pass userId + conversationId
   *  so the builder can pull in that project's instructions + sources. */
  userId?: string;
  conversationId?: string;
  projectId?: string;
  workspaceId?: string;
}

async function loadYamlFile(file: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(path.resolve(HUB_CONFIG_DIR, file), "utf-8");
    return yaml.load(raw);
  } catch {
    return null;
  }
}

function summarizeRecord(value: any, depth = 0): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => summarizeRecord(v, depth + 1))
      .filter(Boolean)
      .map((s) => `  • ${s}`)
      .join("\n");
  }
  if (typeof value === "object") {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      const inner = summarizeRecord(v, depth + 1);
      if (!inner) continue;
      const isMulti = inner.includes("\n");
      lines.push(isMulti ? `${k}:\n${inner}` : `${k}: ${inner}`);
    }
    return lines.join("\n");
  }
  return "";
}

export async function buildZedAdminContext(
  opts: AdminContextOptions = {},
): Promise<BuiltContext> {
  const meta: BuiltContext["meta"] = {
    rulesetFiles: [],
    enabledIntegrations: [],
    customIntegrations: [],
    parametersCount: 0,
    voiceApplied: false,
  };
  const sections: string[] = [];

  // ── 0. "How Zed sounds" — the plain-English voice surface ─────────
  // Placed first so it anchors the model's voice before any of the
  // older YAML dumps below. Falls through silently if the settings
  // aren't loadable (fresh install with no settings file).
  try {
    const settings = await loadAdminSettings();
    if (settings.voice) {
      sections.push(voiceSettingsToPrompt(settings.voice));
      meta.voiceApplied = true;
    }
  } catch {
    /* non-fatal — YAML fallback below still applies */
  }

  // ── 1. Ruleset (personality, security, parameters, access) ─────────
  const ruleset: Record<string, any> = {};
  for (const file of ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"]) {
    const data = await loadYamlFile(file);
    if (data) {
      ruleset[file.replace(".yaml", "")] = data;
      meta.rulesetFiles.push(file);
    }
  }

  const personality = summarizeRecord(ruleset.personality);
  if (personality) {
    sections.push(`## ADMIN-DEFINED PERSONALITY\nAlways behave consistently with these rules:\n${personality}`);
  }

  const parameters = summarizeRecord(ruleset.parameters);
  if (parameters) {
    sections.push(
      `## ADMIN-DEFINED PARAMETERS\nThese operational parameters MUST be respected on every response:\n${parameters}`,
    );
    meta.parametersCount = (parameters.match(/\n/g)?.length || 0) + 1;
  }

  const security = summarizeRecord(ruleset.security);
  if (security) {
    sections.push(
      `## ADMIN-DEFINED SECURITY RULES\nNever violate these:\n${security}`,
    );
  }

  const access = summarizeRecord(ruleset.access);
  if (access) {
    sections.push(`## ADMIN-DEFINED ACCESS POLICY\n${access}`);
  }

  // ── 2. Active integrations ─────────────────────────────────────────
  try {
    const settings = await loadAdminSettings();
    const integrations = settings.integrations || ({} as any);
    const tools: string[] = [];

    // Built-in integrations
    if (integrations.email?.enabled) {
      const senders = integrations.email.accounts || [];
      if (senders.length > 0) {
        tools.push(
          `Email — ${senders.length} sender${senders.length === 1 ? "" : "s"} available (${senders
            .map((a: any) => a.label || a.fromAddress || "unnamed")
            .slice(0, 3)
            .join(", ")}${senders.length > 3 ? "…" : ""})`,
        );
        meta.enabledIntegrations.push("email");
      }
    }
    if (integrations.google?.enabled) {
      const accounts = integrations.google.accounts || [];
      if (accounts.length > 0) {
        const scopes = new Set<string>();
        for (const acc of accounts) for (const s of acc.scopes || []) scopes.add(s);
        tools.push(
          `Google — ${accounts.length} account${accounts.length === 1 ? "" : "s"}; scopes: ${Array.from(
            scopes,
          )
            .map((s: string) => s.split("/").pop())
            .join(", ") || "none"}`,
        );
        meta.enabledIntegrations.push("google");
      }
    }
    if (integrations.github?.enabled) {
      const repos = integrations.github.accounts || [];
      if (repos.length > 0) {
        tools.push(
          `GitHub — ${repos.length} repo${repos.length === 1 ? "" : "s"} (${repos
            .map((r: any) => `${r.owner}/${r.repo}`)
            .slice(0, 3)
            .join(", ")}${repos.length > 3 ? "…" : ""})`,
        );
        meta.enabledIntegrations.push("github");
      }
    }
    if (integrations.telephony?.enabled) {
      tools.push(`Telephony — ${integrations.telephony.provider} (${integrations.telephony.phoneNumber || "no number set"})`);
      meta.enabledIntegrations.push("telephony");
    }
    if (integrations.firewall?.enabled) {
      tools.push(`Firewall — Fantasma route via ${integrations.firewall.preferredRoute}`);
      meta.enabledIntegrations.push("firewall");
    }
    if (integrations.gusto?.enabled) {
      tools.push(`Gusto payroll — ${integrations.gusto.environment} (${integrations.gusto.companyId || "no company set"})`);
      meta.enabledIntegrations.push("gusto");
    }
    if (integrations.kalshi?.enabled) {
      tools.push(`Kalshi — ${integrations.kalshi.environment}`);
      meta.enabledIntegrations.push("kalshi");
    }
    if (integrations.businessOperations?.enabled) {
      const coverage = Object.entries(integrations.businessOperations)
        .filter(([k, v]) => v === true && k !== "enabled")
        .map(([k]) => k)
        .join(", ");
      if (coverage) tools.push(`Business operations coverage — ${coverage}`);
      meta.enabledIntegrations.push("businessOperations");
    }

    // Custom integrations (admin-defined)
    const custom = (integrations as any).custom as Array<any> | undefined;
    if (Array.isArray(custom)) {
      for (const c of custom) {
        if (!c?.enabled) continue;
        const fields = (c.fields || [])
          .filter((f: any) => f.key && !f.isSecret)
          .map((f: any) => `${f.key}=${f.value}`)
          .join(", ");
        tools.push(
          `${c.label || "custom integration"}${c.description ? ` — ${c.description}` : ""}${fields ? ` [${fields}]` : ""}`,
        );
        meta.customIntegrations.push(c.label || c.id);
      }
    }

    if (tools.length > 0) {
      sections.push(
        `## ACTIVE INTEGRATIONS\nThese are the live tools / accounts the admin has configured. You may reference them in your responses, but you can only ACTUALLY operate them if the user's request triggers a flow / agent that has been wired to use them. Do NOT pretend to use a tool that isn't on this list.\n\n${tools
          .map((t) => `  • ${t}`)
          .join("\n")}`,
      );
    } else {
      sections.push(
        `## ACTIVE INTEGRATIONS\nNo integrations are enabled. If the user asks to send email / interact with a service, tell them to enable the relevant integration in Admin → Integrations first.`,
      );
    }
  } catch {
    /* non-fatal */
  }

  // ── 3. Project context (instructions + sources) ───────────────────
  // If this call is on a conversation filed under a project, pull the
  // project's instructions and source list into the prompt. This is
  // what makes "Sources" and "Instructions" in the admin / project
  // UI actually flow into the AI on every call.
  if (opts.userId && (opts.conversationId || opts.projectId)) {
    try {
      const projects = await listProjects(opts.userId);
      const project = projects.find((p) =>
        (opts.projectId && p.id === opts.projectId) ||
        (p.conversationIds || []).includes(opts.conversationId!),
      );
      if (project) {
        const projectSections: string[] = [`## PROJECT: ${project.name}`];
        if (project.instructions?.trim()) {
          projectSections.push(
            `### Project instructions (follow these for any response on this conversation):\n${project.instructions.trim()}`,
          );
          meta.projectInstructions = true;
        }
        if (project.sources && project.sources.length > 0) {
          const sourceLines = project.sources.map((s) => {
            const parts = [`• ${s.label}`];
            if (s.url) parts.push(`url: ${s.url}`);
            if (s.text) parts.push(`text:\n${s.text}`);
            if (s.notes) parts.push(`(notes: ${s.notes})`);
            return parts.join("\n  ");
          });
          projectSections.push(
            `### Project sources (reference these when relevant):\n${sourceLines.join("\n")}`,
          );
          meta.projectSourceCount = project.sources.length;
        }
        if (projectSections.length > 1) {
          sections.push(projectSections.join("\n\n"));
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  const text = sections.join("\n\n");
  return { text, meta };
}
