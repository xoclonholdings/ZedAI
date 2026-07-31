import { storage } from "../../storage";

import type { CoreMemoryConfig } from "./types";

function serialize(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function upsertCoreSection(
  key: string,
  value: unknown,
  description: string,
  adminOnly = true,
): Promise<void> {
  await storage.upsertCoreMemory({
    key,
    value: serialize(value),
    description,
    adminOnly,
  });
}

function validateCoreMemoryConfig(config: unknown): config is CoreMemoryConfig {
  if (!config || typeof config !== "object") return false;

  const c = config as Partial<CoreMemoryConfig>;

  return Boolean(
    c.version &&
      c.identity &&
      c.tone &&
      c.operation &&
      c.modes &&
      c.memory_policy &&
      c.access_control &&
      c.risk_model &&
      c.instruction_model &&
      c.tool_policy &&
      c.secrets_policy &&
      c.session_awareness &&
      c.non_admin_behavior,
  );
}

/**
 * Reads core.memory.json from the working directory, validates the
 * shape, and persists every section into the core-memory store.
 * Falls back to the in-memory defaults via the caller-provided
 * `onFallback` when the file is missing, unparseable, or fails
 * schema validation.
 */
export async function loadCoreMemoryFromFile(onFallback: () => Promise<void>): Promise<void> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const coreMemoryPath = path.join(process.cwd(), "core.memory.json");
    const coreMemoryData = await fs.readFile(coreMemoryPath, "utf-8");
    const parsed = JSON.parse(coreMemoryData);

    if (!validateCoreMemoryConfig(parsed)) {
      throw new Error(
        "core.memory.json is valid JSON but does not match the expected ZAR behavior schema.",
      );
    }

    const config = parsed as CoreMemoryConfig;

    // Full source config for future reference/debugging
    await upsertCoreSection(
      "core_config",
      config,
      "Full ZAR core behavior configuration from core.memory.json",
    );

    // Top-level metadata
    await upsertCoreSection(
      "version",
      config.version,
      "ZAR core memory schema version",
    );

    if (config._notes) {
      await upsertCoreSection("notes", config._notes, "ZAR core memory notes");
    }

    // Structured sections
    await upsertCoreSection(
      "identity",
      config.identity,
      "ZAR identity configuration from core.memory.json",
    );
    await upsertCoreSection(
      "tone",
      config.tone,
      "ZAR tone configuration from core.memory.json",
    );
    await upsertCoreSection(
      "operation",
      config.operation,
      "ZAR operation policy from core.memory.json",
    );
    await upsertCoreSection(
      "modes",
      config.modes,
      "ZAR mode configuration from core.memory.json",
    );
    await upsertCoreSection(
      "memory_policy",
      config.memory_policy,
      "ZAR memory usage policy from core.memory.json",
    );
    await upsertCoreSection(
      "access_control",
      config.access_control,
      "ZAR access control policy from core.memory.json",
    );
    await upsertCoreSection(
      "risk_model",
      config.risk_model,
      "ZAR risk model from core.memory.json",
    );
    await upsertCoreSection(
      "instruction_model",
      config.instruction_model,
      "ZAR instruction parsing and confirmation policy from core.memory.json",
    );
    await upsertCoreSection(
      "tool_policy",
      config.tool_policy,
      "ZAR tool and action policy from core.memory.json",
    );
    await upsertCoreSection(
      "secrets_policy",
      config.secrets_policy,
      "ZAR secrets handling policy from core.memory.json",
    );
    await upsertCoreSection(
      "session_awareness",
      config.session_awareness,
      "ZAR adaptive session awareness policy from core.memory.json",
    );
    await upsertCoreSection(
      "non_admin_behavior",
      config.non_admin_behavior,
      "ZAR guest and non-admin behavior policy from core.memory.json",
    );

    // Convenience aliases for older callers or prompt assembly
    await upsertCoreSection(
      "zed_personality",
      {
        name: config.identity.name,
        role: config.identity.role,
        mission: config.identity.mission,
        operation: config.operation,
      },
      "Backward-compatible ZAR personality composite",
    );
    await upsertCoreSection(
      "rules",
      {
        tone_rules: config.tone.rules,
        memory_policy: config.memory_policy,
        risk_model: config.risk_model,
        instruction_model: config.instruction_model,
        secrets_policy: config.secrets_policy,
      },
      "Backward-compatible ZAR rules composite",
    );
    await upsertCoreSection(
      "default_context",
      {
        default_mode: "chat",
        supported_modes: config.modes.available,
        session_mode: config.session_awareness.mode,
      },
      "Backward-compatible ZAR default context composite",
    );
    await upsertCoreSection(
      "access",
      {
        access_control: config.access_control,
        tool_policy: config.tool_policy,
        non_admin_behavior: config.non_admin_behavior,
      },
      "Backward-compatible ZAR access composite",
    );
    await upsertCoreSection(
      "admin_verification",
      {
        required_for_critical: [
          "admin_authenticated",
          "explicit_instruction",
          "clear_target",
          "clear_scope",
          "confirmation",
        ],
        session_awareness: config.session_awareness,
      },
      "Backward-compatible admin verification and escalation composite",
    );

    console.log("[MEMORY] Core memory loaded from core.memory.json");
  } catch (error) {
    console.warn(
      "[MEMORY] Failed to load core.memory.json, using defaults:",
      error,
    );
    await onFallback();
  }
}
