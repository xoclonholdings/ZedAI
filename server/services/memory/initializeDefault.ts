import { storage } from "../../storage";

import { FALLBACK_CORE_MEMORY_CONFIG } from "./fallbackConfig";

/**
 * Seeds the core-memory store with the fallback config. Used when
 * core.memory.json is missing or invalid. Skip-if-existing semantics —
 * never overwrites a value the admin already set in the DB.
 */
export async function initializeDefaultCoreMemory(): Promise<void> {
  const fallbackConfig = FALLBACK_CORE_MEMORY_CONFIG;

  const defaults: Array<{
    key: string;
    value: string;
    description: string;
    adminOnly: boolean;
  }> = [
    {
      key: "core_config",
      value: JSON.stringify(fallbackConfig),
      description: "Full fallback ZED core behavior configuration",
      adminOnly: true,
    },
    {
      key: "version",
      value: fallbackConfig.version,
      description: "ZED core memory schema version (fallback)",
      adminOnly: true,
    },
    {
      key: "identity",
      value: JSON.stringify(fallbackConfig.identity),
      description: "ZED identity configuration (fallback)",
      adminOnly: true,
    },
    {
      key: "tone",
      value: JSON.stringify(fallbackConfig.tone),
      description: "ZED tone configuration (fallback)",
      adminOnly: true,
    },
    {
      key: "operation",
      value: JSON.stringify(fallbackConfig.operation),
      description: "ZED operation policy (fallback)",
      adminOnly: true,
    },
    {
      key: "modes",
      value: JSON.stringify(fallbackConfig.modes),
      description: "ZED mode configuration (fallback)",
      adminOnly: true,
    },
    {
      key: "memory_policy",
      value: JSON.stringify(fallbackConfig.memory_policy),
      description: "ZED memory policy (fallback)",
      adminOnly: true,
    },
    {
      key: "access_control",
      value: JSON.stringify(fallbackConfig.access_control),
      description: "ZED access control policy (fallback)",
      adminOnly: true,
    },
    {
      key: "risk_model",
      value: JSON.stringify(fallbackConfig.risk_model),
      description: "ZED risk model (fallback)",
      adminOnly: true,
    },
    {
      key: "instruction_model",
      value: JSON.stringify(fallbackConfig.instruction_model),
      description: "ZED instruction model (fallback)",
      adminOnly: true,
    },
    {
      key: "tool_policy",
      value: JSON.stringify(fallbackConfig.tool_policy),
      description: "ZED tool policy (fallback)",
      adminOnly: true,
    },
    {
      key: "secrets_policy",
      value: JSON.stringify(fallbackConfig.secrets_policy),
      description: "ZED secrets policy (fallback)",
      adminOnly: true,
    },
    {
      key: "session_awareness",
      value: JSON.stringify(fallbackConfig.session_awareness),
      description: "ZED session awareness policy (fallback)",
      adminOnly: true,
    },
    {
      key: "non_admin_behavior",
      value: JSON.stringify(fallbackConfig.non_admin_behavior),
      description: "ZED non-admin behavior policy (fallback)",
      adminOnly: true,
    },
    {
      key: "zed_personality",
      value: JSON.stringify({
        name: fallbackConfig.identity.name,
        role: fallbackConfig.identity.role,
        mission: fallbackConfig.identity.mission,
        operation: fallbackConfig.operation,
      }),
      description: "Backward-compatible ZED personality composite (fallback)",
      adminOnly: true,
    },
    {
      key: "rules",
      value: JSON.stringify({
        tone_rules: fallbackConfig.tone.rules,
        memory_policy: fallbackConfig.memory_policy,
        risk_model: fallbackConfig.risk_model,
        instruction_model: fallbackConfig.instruction_model,
        secrets_policy: fallbackConfig.secrets_policy,
      }),
      description: "Backward-compatible ZED rules composite (fallback)",
      adminOnly: true,
    },
    {
      key: "default_context",
      value: JSON.stringify({
        default_mode: "chat",
        supported_modes: fallbackConfig.modes.available,
        session_mode: fallbackConfig.session_awareness.mode,
      }),
      description: "Backward-compatible ZED default context composite (fallback)",
      adminOnly: true,
    },
    {
      key: "access",
      value: JSON.stringify({
        access_control: fallbackConfig.access_control,
        tool_policy: fallbackConfig.tool_policy,
        non_admin_behavior: fallbackConfig.non_admin_behavior,
      }),
      description: "Backward-compatible ZED access composite (fallback)",
      adminOnly: true,
    },
    {
      key: "admin_verification",
      value: JSON.stringify({
        required_for_critical:
          fallbackConfig.risk_model.enforcement.critical_requires,
        session_awareness: fallbackConfig.session_awareness,
      }),
      description: "Backward-compatible admin verification composite (fallback)",
      adminOnly: true,
    },
  ];

  for (const defaultMemory of defaults) {
    const existing = await storage.getCoreMemoryByKey(defaultMemory.key);
    if (!existing) {
      await storage.upsertCoreMemory(defaultMemory);
    }
  }
}
