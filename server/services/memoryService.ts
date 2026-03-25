import { storage } from "../storage";
import {
  type InsertCoreMemory,
  type InsertProjectMemory,
  type InsertScratchpadMemory,
  type CoreMemory,
  type ProjectMemory,
  type ScratchpadMemory,
} from "@shared/schema";

type CoreMemoryConfig = {
  version: string;
  _notes?: string;
  identity: {
    name: string;
    role: string;
    mission: string;
  };
  tone: {
    mode: string;
    baseline: string;
    rules: string[];
    _planned?: string;
  };
  operation: {
    execution_mode: string;
    default_behavior: string;
    _notes?: string;
  };
  modes: {
    available: string[];
    behavior: string;
    _notes?: string;
  };
  memory_policy: {
    usage: string;
    sensitive_handling: string;
    classification_levels: string[];
    _notes?: string;
  };
  access_control: {
    roles: Record<string, string[]>;
    override: {
      enabled: boolean;
      _notes?: string;
    };
  };
  risk_model: {
    tiers: string[];
    definitions: Record<string, string>;
    enforcement: {
      critical_requires: string[];
    };
  };
  instruction_model: {
    required_fields: string[];
    confirmation_required_for: string[];
    ambiguity_handling: string;
    _notes?: string;
  };
  tool_policy: {
    actions: string[];
    enforcement_order: string[];
    _notes?: string;
  };
  secrets_policy: {
    default_behavior: string;
    allowed_behavior: string[];
    critical_access: {
      requires: string[];
    };
  };
  session_awareness: {
    mode: string;
    behaviors: string[];
    _planned?: string;
  };
  non_admin_behavior: {
    mode: string;
    capabilities: string[];
    restrictions: string[];
  };
};

export class MemoryService {
  // Core Memory - Persistent system configuration
  static async getCoreMemory(key: string): Promise<CoreMemory | null> {
    return await storage.getCoreMemoryByKey(key);
  }

  static async setCoreMemory(data: InsertCoreMemory): Promise<CoreMemory> {
    return await storage.upsertCoreMemory(data);
  }

  static async getAllCoreMemory(): Promise<CoreMemory[]> {
    return await storage.getAllCoreMemory();
  }

  // Project Memory - Saved context and datasets
  static async getProjectMemory(userId: string): Promise<ProjectMemory[]> {
    return await storage.getProjectMemoryByUser(userId);
  }

  static async createProjectMemory(
    data: InsertProjectMemory,
  ): Promise<ProjectMemory> {
    return await storage.createProjectMemory(data);
  }

  static async updateProjectMemory(
    id: string,
    updates: Partial<InsertProjectMemory>,
  ): Promise<ProjectMemory> {
    return await storage.updateProjectMemory(id, updates);
  }

  static async deleteProjectMemory(id: string): Promise<boolean> {
    return await storage.deleteProjectMemory(id);
  }

  // Scratchpad Memory - Temporary working memory
  static async getScratchpadMemory(userId: string): Promise<ScratchpadMemory[]> {
    return await storage.getScratchpadMemoryByUser(userId);
  }

  static async createScratchpadMemory(
    data: InsertScratchpadMemory,
  ): Promise<ScratchpadMemory> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return await storage.createScratchpadMemory({
      ...data,
      expiresAt,
    });
  }

  // Daily reset for scratchpad memory
  static async resetScratchpadMemory(): Promise<void> {
    await storage.cleanupExpiredScratchpadMemory();
  }

  private static serialize(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  private static async upsertCoreSection(
    key: string,
    value: unknown,
    description: string,
    adminOnly = true,
  ): Promise<void> {
    await this.setCoreMemory({
      key,
      value: this.serialize(value),
      description,
      adminOnly,
    });
  }

  private static validateCoreMemoryConfig(
    config: unknown,
  ): config is CoreMemoryConfig {
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

  // Load core memory from JSON file
  static async loadCoreMemoryFromFile(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const coreMemoryPath = path.join(process.cwd(), "core.memory.json");
      const coreMemoryData = await fs.readFile(coreMemoryPath, "utf-8");
      const parsed = JSON.parse(coreMemoryData);

      if (!this.validateCoreMemoryConfig(parsed)) {
        throw new Error(
          "core.memory.json is valid JSON but does not match the expected Zed behavior schema.",
        );
      }

      const coreMemoryConfig = parsed as CoreMemoryConfig;

      // Store the full source config for future reference/debugging
      await this.upsertCoreSection(
        "core_config",
        coreMemoryConfig,
        "Full ZED core behavior configuration from core.memory.json",
      );

      // Store top-level metadata
      await this.upsertCoreSection(
        "version",
        coreMemoryConfig.version,
        "ZED core memory schema version",
      );

      if (coreMemoryConfig._notes) {
        await this.upsertCoreSection(
          "notes",
          coreMemoryConfig._notes,
          "ZED core memory notes",
        );
      }

      // Store structured sections
      await this.upsertCoreSection(
        "identity",
        coreMemoryConfig.identity,
        "ZED identity configuration from core.memory.json",
      );

      await this.upsertCoreSection(
        "tone",
        coreMemoryConfig.tone,
        "ZED tone configuration from core.memory.json",
      );

      await this.upsertCoreSection(
        "operation",
        coreMemoryConfig.operation,
        "ZED operation policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "modes",
        coreMemoryConfig.modes,
        "ZED mode configuration from core.memory.json",
      );

      await this.upsertCoreSection(
        "memory_policy",
        coreMemoryConfig.memory_policy,
        "ZED memory usage policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "access_control",
        coreMemoryConfig.access_control,
        "ZED access control policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "risk_model",
        coreMemoryConfig.risk_model,
        "ZED risk model from core.memory.json",
      );

      await this.upsertCoreSection(
        "instruction_model",
        coreMemoryConfig.instruction_model,
        "ZED instruction parsing and confirmation policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "tool_policy",
        coreMemoryConfig.tool_policy,
        "ZED tool and action policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "secrets_policy",
        coreMemoryConfig.secrets_policy,
        "ZED secrets handling policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "session_awareness",
        coreMemoryConfig.session_awareness,
        "ZED adaptive session awareness policy from core.memory.json",
      );

      await this.upsertCoreSection(
        "non_admin_behavior",
        coreMemoryConfig.non_admin_behavior,
        "ZED guest and non-admin behavior policy from core.memory.json",
      );

      // Convenience aliases for older callers or prompt assembly
      await this.upsertCoreSection(
        "zed_personality",
        {
          name: coreMemoryConfig.identity.name,
          role: coreMemoryConfig.identity.role,
          mission: coreMemoryConfig.identity.mission,
          operation: coreMemoryConfig.operation,
        },
        "Backward-compatible ZED personality composite",
      );

      await this.upsertCoreSection(
        "rules",
        {
          tone_rules: coreMemoryConfig.tone.rules,
          memory_policy: coreMemoryConfig.memory_policy,
          risk_model: coreMemoryConfig.risk_model,
          instruction_model: coreMemoryConfig.instruction_model,
          secrets_policy: coreMemoryConfig.secrets_policy,
        },
        "Backward-compatible ZED rules composite",
      );

      await this.upsertCoreSection(
        "default_context",
        {
          default_mode: "chat",
          supported_modes: coreMemoryConfig.modes.available,
          session_mode: coreMemoryConfig.session_awareness.mode,
        },
        "Backward-compatible ZED default context composite",
      );

      await this.upsertCoreSection(
        "access",
        {
          access_control: coreMemoryConfig.access_control,
          tool_policy: coreMemoryConfig.tool_policy,
          non_admin_behavior: coreMemoryConfig.non_admin_behavior,
        },
        "Backward-compatible ZED access composite",
      );

      await this.upsertCoreSection(
        "admin_verification",
        {
          required_for_critical: [
            "admin_authenticated",
            "explicit_instruction",
            "clear_target",
            "clear_scope",
            "confirmation",
          ],
          session_awareness: coreMemoryConfig.session_awareness,
        },
        "Backward-compatible admin verification and escalation composite",
      );

      console.log("[MEMORY] Core memory loaded from core.memory.json");
    } catch (error) {
      console.warn(
        "[MEMORY] Failed to load core.memory.json, using defaults:",
        error,
      );
      await this.initializeDefaultCoreMemory();
    }
  }

  // Initialize default core memory values as fallback
  static async initializeDefaultCoreMemory(): Promise<void> {
    const fallbackConfig: CoreMemoryConfig = {
      version: "2.0-fallback",
      _notes:
        "Fallback ZED behavior configuration used when core.memory.json is missing or invalid.",
      identity: {
        name: "Zed",
        role: "Diagnostic, solution-based AI co-pilot",
        mission:
          "Help the Admin solve problems clearly, strategically, and safely.",
      },
      tone: {
        mode: "adaptive_with_boundaries",
        baseline: "strategic, calm, sharp, concise",
        rules: [
          "Clarity over cleverness",
          "Precision over flourish",
          "Humor may support understanding but never replace it",
        ],
        _planned: "Per-mode tone modulation",
      },
      operation: {
        execution_mode: "controlled_write_with_authorization",
        default_behavior: "read_only_analysis",
        _notes:
          "Fallback policy: Zed can analyze and generate suggestions, but should not assume write authority.",
      },
      modes: {
        available: [
          "chat",
          "diagnostic",
          "debug",
          "developer",
          "architect",
          "deployment",
          "security",
          "memory",
          "agent",
          "analysis",
          "audit",
          "simulation",
          "product",
          "growth",
        ],
        behavior: "mode_influences_reasoning_not_permissions",
        _notes: "Capabilities remain gated by auth and tool availability.",
      },
      memory_policy: {
        usage: "auto_with_transparency",
        sensitive_handling: "requires_confirmation",
        classification_levels: [
          "public",
          "operational",
          "sensitive",
          "restricted",
        ],
        _notes:
          "Fallback memory policy favors speed with disclosure and caution.",
      },
      access_control: {
        roles: {
          guest: ["low"],
          authenticated: ["low"],
          authorized: ["low", "medium"],
          admin: ["low", "medium", "high", "critical"],
        },
        override: {
          enabled: true,
          _notes: "Admin may override per session if enforcement supports it.",
        },
      },
      risk_model: {
        tiers: ["low", "medium", "high", "critical"],
        definitions: {
          low: "Explanations, summaries, user-provided rewrites.",
          medium: "Project file rewrites, refactors, non-sensitive internal analysis.",
          high: "Sensitive system logic, auth, config, and architecture analysis.",
          critical:
            "Secrets, credentials, protected memory, security systems.",
        },
        enforcement: {
          critical_requires: [
            "admin_authenticated",
            "explicit_instruction",
            "clear_target",
            "clear_scope",
            "confirmation",
          ],
        },
      },
      instruction_model: {
        required_fields: ["action", "target", "scope"],
        confirmation_required_for: ["high", "critical"],
        ambiguity_handling: "confirm_before_execution",
        _notes:
          "Strict structured instruction model with Zed confirmation before proceeding.",
      },
      tool_policy: {
        actions: ["inspect", "analyze", "generate", "modify", "reveal"],
        enforcement_order: [
          "user_auth",
          "tool_availability",
          "role_permissions",
          "mode_behavior",
        ],
        _notes:
          "Mode changes reasoning style, not underlying permissions.",
      },
      secrets_policy: {
        default_behavior: "no_raw_exposure",
        allowed_behavior: ["summarize", "redact", "structure_analysis"],
        critical_access: {
          requires: [
            "admin_authenticated",
            "explicit_request",
            "confirmation",
          ],
        },
      },
      session_awareness: {
        mode: "adaptive",
        behaviors: [
          "detect_pattern_changes",
          "increase_caution_on_sensitive_actions",
          "request_reconfirmation_when_needed",
        ],
        _planned: "Future anomaly scoring and session risk monitoring",
      },
      non_admin_behavior: {
        mode: "guest_personality",
        capabilities: ["general_help", "product_guidance"],
        restrictions: [
          "no_diagnostics",
          "no_internal_memory_access",
          "no_system_exposure",
        ],
      },
    };

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
        description:
          "Backward-compatible admin verification composite (fallback)",
        adminOnly: true,
      },
    ];

    for (const defaultMemory of defaults) {
      const existing = await this.getCoreMemory(defaultMemory.key);
      if (!existing) {
        await this.setCoreMemory(defaultMemory);
      }
    }
  }
}