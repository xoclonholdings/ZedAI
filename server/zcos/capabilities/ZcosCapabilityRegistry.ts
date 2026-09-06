import { randomUUID } from "crypto";

import type {
  ZcosCapabilityDefinition,
  ZcosCapabilityGap,
  ZcosCapabilityInvocation,
  ZcosPermission,
} from "../../../shared/zcos-intelligence";
import { zyloArtifactResolver, type ZyloArtifactResolver } from "./ZyloArtifactResolver";

export interface CapabilityResolutionContext {
  permissions: Set<ZcosPermission>;
  configuredIntegrations: Set<string>;
  approvedCapabilityIds?: Set<string>;
}

export interface CapabilityResolution {
  invocations: ZcosCapabilityInvocation[];
  gaps: ZcosCapabilityGap[];
  parallelGroups: string[][];
  sequentialOrder: string[];
}

export class ZcosCapabilityRegistry {
  private readonly definitions = new Map<string, ZcosCapabilityDefinition>();

  constructor(
    definitions: ZcosCapabilityDefinition[] = [],
    private readonly artifacts: ZyloArtifactResolver = zyloArtifactResolver,
  ) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: ZcosCapabilityDefinition): void {
    if (!definition.id?.trim() || definition.operations.length === 0) throw new Error("Capability id and operation are required.");
    if (!/^\d+\.\d+\.\d+$/.test(definition.version)) throw new Error(`Capability version must be exact semver: ${definition.id}@${definition.version}`);
    if (definition.dependencies.includes(definition.id)) throw new Error(`Capability cannot depend on itself: ${definition.id}`);
    if (this.definitions.has(definition.id)) throw new Error(`Capability already registered: ${definition.id}`);
    const stored = {
      ...definition,
      operations: [...definition.operations],
      permissions: [...definition.permissions],
      requiredIntegrations: [...definition.requiredIntegrations],
      dependencies: [...definition.dependencies],
      artifacts: definition.artifacts.map((artifact) => Object.freeze({ ...artifact })),
    };
    Object.freeze(stored.operations);
    Object.freeze(stored.permissions);
    Object.freeze(stored.requiredIntegrations);
    Object.freeze(stored.dependencies);
    Object.freeze(stored.artifacts);
    Object.freeze(stored);
    this.definitions.set(definition.id, stored);
  }

  get(id: string): ZcosCapabilityDefinition | null {
    return this.definitions.get(id) || null;
  }

  list(): ZcosCapabilityDefinition[] {
    return [...this.definitions.values()];
  }

  resolve(capabilityIds: string[], context: CapabilityResolutionContext): CapabilityResolution {
    const invocations: ZcosCapabilityInvocation[] = [];
    const gaps: ZcosCapabilityGap[] = [];
    const invocationByCapability = new Map<string, ZcosCapabilityInvocation>();

    for (const capabilityId of [...new Set(capabilityIds)]) {
      const definition = this.get(capabilityId);
      if (!definition) {
        gaps.push(this.gap(capabilityId, "not_registered", [], "Capability is not registered in ZCOS."));
        continue;
      }
      if (definition.certificationState === "blocked" || definition.certificationState === "planned" || definition.certificationState === "retired") {
        gaps.push(this.gap(capabilityId, "not_certified", [], `Capability state is ${definition.certificationState}.`));
        continue;
      }
      const missingPermissions = definition.permissions.filter((permission) => !context.permissions.has(permission));
      if (missingPermissions.length > 0) {
        gaps.push(this.gap(capabilityId, "permission_missing", [], `Missing permission: ${missingPermissions.join(", ")}.`));
        continue;
      }
      const missingIntegrations = definition.requiredIntegrations.filter(
        (integration) => !context.configuredIntegrations.has(integration),
      );
      if (missingIntegrations.length > 0) {
        gaps.push(this.gap(capabilityId, "integration_missing", missingIntegrations, "Required integration is not connected."));
        continue;
      }
      const unresolvedArtifact = definition.artifacts.find((artifact) => !this.artifacts.resolve(artifact));
      if (unresolvedArtifact) {
        gaps.push(this.gap(capabilityId, "artifact_unresolved", [], `ZYLO could not resolve ${unresolvedArtifact.id}@${unresolvedArtifact.version}.`));
        continue;
      }

      const approvalRequired =
        definition.approvalRequired && !context.approvedCapabilityIds?.has(definition.id);
      const invocation: ZcosCapabilityInvocation = {
        invocationId: randomUUID(),
        capabilityId: definition.id,
        ownerGalaxy: definition.ownerGalaxy,
        operation: definition.operations[0] || "execute",
        dependencyIds: [...definition.dependencies],
        approvalRequired,
        sideEffect: definition.sideEffect,
        artifacts: definition.artifacts.map((artifact) => ({ ...artifact })),
        status: approvalRequired ? "blocked" : "planned",
      };
      invocations.push(invocation);
      invocationByCapability.set(definition.id, invocation);
    }

    const runnable = invocations.filter((invocation) => invocation.status === "planned");
    for (const invocation of runnable) {
      for (const dependencyId of invocation.dependencyIds) {
        if (!invocationByCapability.has(dependencyId)) {
          invocation.status = "blocked";
          gaps.push(this.gap(invocation.capabilityId, "dependency_unresolved", [], `Dependency ${dependencyId} was not resolved.`));
        }
      }
    }

    const parallelGroups: string[][] = [];
    const sequentialOrder: string[] = [];
    const pending = new Map(
      runnable
        .filter((invocation) => invocation.status === "planned")
        .map((invocation) => [invocation.capabilityId, invocation]),
    );
    const completedCapabilities = new Set<string>();
    while (pending.size > 0) {
      const ready = [...pending.values()].filter((invocation) =>
        invocation.dependencyIds.every((dependencyId) => completedCapabilities.has(dependencyId)),
      );
      if (ready.length === 0) {
        for (const invocation of pending.values()) {
          invocation.status = "blocked";
          gaps.push(this.gap(invocation.capabilityId, "dependency_unresolved", [], "Capability dependency cycle or blocked dependency detected."));
        }
        break;
      }
      const parallelReady = ready.filter((invocation) => {
        const definition = this.get(invocation.capabilityId);
        return definition?.parallelSafe && definition.sideEffect === "none";
      });
      if (parallelReady.length > 1) {
        parallelGroups.push(parallelReady.map((invocation) => invocation.invocationId));
      }
      for (const invocation of ready) {
        sequentialOrder.push(invocation.invocationId);
        completedCapabilities.add(invocation.capabilityId);
        pending.delete(invocation.capabilityId);
      }
    }

    return { invocations, gaps, parallelGroups, sequentialOrder };
  }

  private gap(
    capabilityId: string,
    reason: ZcosCapabilityGap["reason"],
    missingIntegrations: string[],
    message: string,
  ): ZcosCapabilityGap {
    return { capabilityId, reason, missingIntegrations, settingsPath: "/settings/integrations", message };
  }
}

const reasoningArtifact = { kind: "skill", id: "reasoning.plan", version: "1.0.0", ownerGalaxy: "ZYLO" } as const;

export const zcosCapabilityRegistry = new ZcosCapabilityRegistry([
  {
    id: "zcos.context.internal",
    label: "Internal context assembly",
    ownerGalaxy: "ZCOS",
    operations: ["retrieve_and_assemble"],
    permissions: [],
    requiredIntegrations: [],
    certificationState: "certified",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: true,
    dependencies: [],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zcos.reasoning.plan",
    label: "ZCOS reasoning and planning",
    ownerGalaxy: "ZCOS",
    operations: ["reason_and_plan"],
    permissions: [],
    requiredIntegrations: [],
    certificationState: "certified",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.context.internal"],
    artifacts: [reasoningArtifact],
    version: "1.0.0",
  },
  {
    id: "zcos.external.web_fetch",
    label: "Direct current-source retrieval",
    ownerGalaxy: "ZCOS",
    operations: ["fetch"],
    permissions: ["external:read"],
    requiredIntegrations: [],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: true,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "research.governed-retrieval", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zcos.external.web_search",
    label: "Current-source web retrieval",
    ownerGalaxy: "ZCOS",
    operations: ["search"],
    permissions: ["external:read"],
    requiredIntegrations: ["web_search"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: true,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "research.governed-retrieval", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zcos.external.model_synthesis",
    label: "Provider-neutral model synthesis",
    ownerGalaxy: "ZCOS",
    operations: ["synthesize"],
    permissions: ["model:invoke"],
    requiredIntegrations: ["model_provider"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [reasoningArtifact],
    version: "1.0.0",
  },
  {
    id: "zar.operate.research",
    label: "ZAR Brainstorm/Research",
    ownerGalaxy: "ZAR",
    operations: ["research"],
    permissions: ["external:read"],
    requiredIntegrations: ["web_search", "model_provider"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "research.governed-retrieval", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zar.operate.tasks.prepare",
    label: "ZAR task preparation",
    ownerGalaxy: "ZAR",
    operations: ["prepare"],
    permissions: ["action:prepare"],
    requiredIntegrations: [],
    certificationState: "provisional",
    sideEffect: "internal_write",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "tasks.approval-gated-execution", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zar.external.action",
    label: "Consequential external action",
    ownerGalaxy: "ZAR",
    operations: ["execute"],
    permissions: ["action:execute"],
    requiredIntegrations: [],
    certificationState: "provisional",
    sideEffect: "external_write",
    approvalRequired: true,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "tasks.approval-gated-execution", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zillion.capital.delegate",
    label: "ZILLION Prosper Capital delegation",
    ownerGalaxy: "ZILLION",
    operations: ["delegate"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zillion_capital"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [{ kind: "workflow", id: "capital.delegate", version: "1.0.0", ownerGalaxy: "ZYLO" }],
    version: "1.0.0",
  },
  {
    id: "zync.build.delegate",
    label: "ZYNC Canvas Build assignment",
    ownerGalaxy: "ZYNC",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zync_build"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zylo.automate.delegate",
    label: "ZYLO Compass automation assignment",
    ownerGalaxy: "ZYLO",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zylo_automate"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zena.integrity.delegate",
    label: "ZENA Control Integrity assignment",
    ownerGalaxy: "ZENA",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zena_integrity"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zeno.unite.delegate",
    label: "ZENO Unite communication assignment",
    ownerGalaxy: "ZENO",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zeno_unite"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zenith.scholar.delegate",
    label: "ZENITH Logos learning assignment",
    ownerGalaxy: "ZENITH",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zenith_scholar"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
  {
    id: "zwap.discovery.delegate",
    label: "ZWAP! Discovery assignment",
    ownerGalaxy: "ZWAP!",
    operations: ["assign"],
    permissions: ["action:prepare"],
    requiredIntegrations: ["zwap_discovery"],
    certificationState: "provisional",
    sideEffect: "none",
    approvalRequired: false,
    parallelSafe: false,
    dependencies: ["zcos.reasoning.plan"],
    artifacts: [],
    version: "1.0.0",
  },
]);
