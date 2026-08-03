/**
 * Factory for creating and managing subagent instances.
 * Instantiates subagents by type and manages the pool.
 */

import { SubagentBase } from "./SubagentBase";
import type { SubagentName, SubagentPoolConfig } from "./SubagentTypes";
import { FinanceSubagent } from "./implementations/FinanceSubagent";
import { IntelligenceSubagent } from "./implementations/IntelligenceSubagent";
import { OperationsSubagent } from "./implementations/OperationsSubagent";
import { BusinessSubagent } from "./implementations/BusinessSubagent";

export class SubagentFactory {
  private pool: Map<SubagentName, SubagentBase> = new Map();
  private config: SubagentPoolConfig;

  constructor(config: SubagentPoolConfig) {
    this.config = config;
    this.initializePool();
  }

  private initializePool(): void {
    const disabledSubagents = new Set(this.config.disabledSubagents || []);

    const subagentDefinitions: Array<{ name: SubagentName; factory: () => SubagentBase }> = [
      { name: "FinanceSubagent", factory: () => new FinanceSubagent() },
      { name: "IntelligenceSubagent", factory: () => new IntelligenceSubagent() },
      { name: "OperationsSubagent", factory: () => new OperationsSubagent() },
      { name: "BusinessSubagent", factory: () => new BusinessSubagent() },
    ];

    for (const def of subagentDefinitions) {
      if (!disabledSubagents.has(def.name)) {
        this.pool.set(def.name, def.factory());
      }
    }
  }

  /**
   * Get all active subagents in the pool.
   */
  getActiveSubagents(): SubagentBase[] {
    return Array.from(this.pool.values());
  }

  /**
   * Get a specific subagent by name.
   */
  getSubagent(name: SubagentName): SubagentBase | undefined {
    return this.pool.get(name);
  }

  /**
   * Check if a subagent is enabled.
   */
  isEnabled(name: SubagentName): boolean {
    return this.pool.has(name);
  }

  /**
   * Enable or disable a subagent at runtime.
   */
  setEnabled(name: SubagentName, enabled: boolean): void {
    if (enabled && !this.pool.has(name)) {
      switch (name) {
        case "FinanceSubagent":
          this.pool.set(name, new FinanceSubagent());
          break;
        case "IntelligenceSubagent":
          this.pool.set(name, new IntelligenceSubagent());
          break;
        case "OperationsSubagent":
          this.pool.set(name, new OperationsSubagent());
          break;
        case "BusinessSubagent":
          this.pool.set(name, new BusinessSubagent());
          break;
      }
    } else if (!enabled && this.pool.has(name)) {
      this.pool.delete(name);
    }
  }

  /**
   * Update pool configuration (e.g., concurrency, timeout).
   */
  updateConfig(config: Partial<SubagentPoolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current pool configuration.
   */
  getConfig(): SubagentPoolConfig {
    return { ...this.config };
  }
}
