import { describe, expect, it } from "vitest";

import {
  ZCOS_INTELLIGENCE_SCHEMA_VERSION,
  type ZcosResultEnvelope,
  type ZcosCapabilityDefinition,
  type ZcosPermission,
  type ZcosSourceEnvelope,
} from "../../../shared/zcos-intelligence";
import { ZcosCapabilityRegistry } from "../capabilities/ZcosCapabilityRegistry";
import { ZcosRequestInterpreter } from "./ZcosRequestInterpreter";
import { SourceConfluenceEngine } from "./SourceConfluenceEngine";
import { ZcosUnifiedIntelligenceRuntime } from "./ZcosUnifiedIntelligenceRuntime";

function request(message: string, options: { externalActionsAuthorized?: boolean } = {}) {
  return ZcosRequestInterpreter.interpret({
    traceId: `trace-${message.length}`,
    userId: "owner_runtime_test",
    message,
    route: "/api/orchestrate",
    externalActionsAuthorized: options.externalActionsAuthorized,
  });
}

function source(overrides: Partial<ZcosSourceEnvelope> = {}): ZcosSourceEnvelope {
  return {
    sourceId: overrides.sourceId || "source-1",
    type: overrides.type || "knowledge",
    authority: overrides.authority || "canonical",
    originGalaxy: overrides.originGalaxy || "ZCOS",
    originClass: overrides.originClass || "internal_canonical",
    title: overrides.title || "Canonical knowledge",
    content: overrides.content || "The governed internal answer is available.",
    confidence: overrides.confidence ?? 0.9,
    currency: overrides.currency || "current",
    claims: overrides.claims,
    provenance: overrides.provenance || {
      retrievedAt: "2026-08-22T00:00:00.000Z",
      independenceKey: "canonical:knowledge",
      lineage: ["knowledge-record-1"],
    },
  };
}

function prepare(message: string, sources: ZcosSourceEnvelope[] = []) {
  return ZcosUnifiedIntelligenceRuntime.prepare({
    request: request(message),
    sources,
    strategic: false,
    materialUncertainty: false,
    hasFiles: false,
    hasGraphContext: false,
    hasMemory: sources.some((item) => item.type === "memory" || item.type === "knowledge"),
    configuredIntegrations: new Set(["model_provider", "web_search", "zillion_capital"]),
  });
}

describe("ZCOS unified intelligence runtime", () => {
  it("fails closed when a typed request has no authenticated owner", () => {
    expect(() => ZcosRequestInterpreter.interpret({
      traceId: "trace-anonymous",
      userId: "anonymous",
      message: "hello",
      route: "/api/orchestrate",
    })).toThrow("Authenticated owner is required");
  });

  it("prioritizes sufficient current canonical knowledge before external retrieval", () => {
    const prepared = prepare("Summarize the governed project context.", [source()]);
    expect(prepared.executionPlan.externalRetrievalRequired).toBe(false);
    expect(prepared.executionPlan.invocations.map((item) => item.capabilityId)).not.toContain("zcos.external.web_search");
    expect(prepared.trace.contextSourceIds).toEqual(["source-1"]);
  });

  it("requires current retrieval for freshness and preserves integration gaps", () => {
    const freshRequest = request("What is the latest release status?");
    const prepared = ZcosUnifiedIntelligenceRuntime.prepare({
      request: freshRequest,
      sources: [source({ currency: "potentially_outdated" })],
      strategic: false,
      materialUncertainty: false,
      hasFiles: false,
      hasGraphContext: false,
      hasMemory: true,
      configuredIntegrations: new Set(["model_provider"]),
    });
    expect(prepared.executionPlan.externalRetrievalRequired).toBe(true);
    expect(prepared.executionPlan.capabilityGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: "zcos.external.web_search",
        reason: "integration_missing",
        settingsPath: "/settings/integrations",
      }),
    ]));
  });

  it("orders current-source retrieval before provider synthesis", () => {
    const prepared = prepare("What is the latest release status?");
    const byInvocationId = new Map(
      prepared.executionPlan.invocations.map((invocation) => [invocation.invocationId, invocation.capabilityId]),
    );
    const orderedCapabilities = prepared.executionPlan.sequentialOrder.map((id) => byInvocationId.get(id));
    expect(orderedCapabilities.indexOf("zcos.external.web_search")).toBeLessThan(
      orderedCapabilities.indexOf("zcos.external.model_synthesis"),
    );
    expect(prepared.executionPlan.invocations.find((item) => item.capabilityId === "zcos.external.model_synthesis")?.dependencyIds)
      .toContain("zcos.external.web_search");
  });

  it("preserves missing current-source validation as material uncertainty", () => {
    const prepared = prepare("What is the latest release status?");
    const candidate = ZcosUnifiedIntelligenceRuntime.wrapExecutionResult(prepared, "Unverified candidate");
    const verification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(prepared, candidate);
    expect(verification.status).toBe("verified_with_uncertainty");
    expect(verification.uncertainties).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "current_source_missing", material: true }),
    ]));
  });

  it("preserves independent-source conflicts instead of collapsing them", () => {
    const evaluated = SourceConfluenceEngine.evaluate([
      source({ sourceId: "a", claims: [{ key: "release", value: "stable" }] }),
      source({
        sourceId: "b",
        claims: [{ key: "release", value: "beta" }],
        provenance: {
          retrievedAt: "2026-08-22T00:00:00.000Z",
          independenceKey: "primary:release-notes",
          lineage: ["release-notes"],
        },
      }),
      source({ sourceId: "c", claims: [{ key: "release", value: "stable" }] }),
    ]);
    expect(evaluated.report.independentSourceCount).toBe(2);
    expect(evaluated.report.duplicateLineageCount).toBe(1);
    expect(evaluated.report.conflicts).toHaveLength(1);
    expect(evaluated.uncertainties[0]).toMatchObject({ code: "source_conflict", resolution: "preserve" });
  });

  it("keeps external actions blocked until permission and approval are explicit", () => {
    const prepared = prepare("Send and publish the final report.");
    expect(prepared.executionPlan.capabilityGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: "zar.external.action", reason: "permission_missing" }),
    ]));
    expect(prepared.executionPlan.invocations.some((item) => item.sideEffect === "external_write" && item.status === "planned")).toBe(false);
  });

  it("delegates capital work without creating a competing model authority", () => {
    const prepared = prepare("Build a budget plan.");
    const capabilityIds = prepared.executionPlan.invocations.map((item) => item.capabilityId);
    expect(capabilityIds).toContain("zillion.capital.delegate");
    expect(capabilityIds).not.toContain("zcos.external.model_synthesis");
  });

  it("falls back to governed synthesis while preserving a missing Capital connector gap", () => {
    const capitalRequest = request("Build a budget plan.");
    const prepared = ZcosUnifiedIntelligenceRuntime.prepare({
      request: capitalRequest,
      sources: [],
      strategic: false,
      materialUncertainty: false,
      hasFiles: false,
      hasGraphContext: false,
      hasMemory: false,
      configuredIntegrations: new Set(["model_provider"]),
    });
    expect(prepared.executionPlan.invocations.map((item) => item.capabilityId)).toContain("zcos.external.model_synthesis");
    expect(prepared.executionPlan.capabilityGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: "zillion.capital.delegate", reason: "integration_missing" }),
    ]));
  });

  it("rejects an external provider result that attempts a canonical mutation", () => {
    const prepared = prepare("Explain the architecture.", [source()]);
    const result: ZcosResultEnvelope<{ text: string }> = {
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      resultId: "result-mutation",
      requestId: prepared.request.requestId,
      type: "execution",
      status: "success",
      data: { text: "candidate" },
      sourceIds: ["source-1"],
      uncertainties: [],
      errors: [],
      provenance: {
        provider: "external-test",
        retrievedAt: "2026-08-22T00:00:00.000Z",
        independenceKey: "provider:external-test",
        lineage: ["source-1"],
      },
      writeDisposition: "approved_mutation",
    };
    const verification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(prepared, result);
    expect(verification.status).toBe("failed");
    expect(verification.errors[0].code).toBe("result_policy_violation");
  });

  it("records and validates intermediate retrieval results before the final execution result", () => {
    const prepared = prepare("What is the latest release status?");
    const currentSource = source({
      sourceId: "external-current",
      type: "external_search",
      authority: "source",
      originClass: "external_primary",
      provenance: {
        retrievedAt: "2026-08-22T00:00:00.000Z",
        independenceKey: "primary:release-notes",
        lineage: ["release-notes"],
      },
    });
    const retrieval: ZcosResultEnvelope = {
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      resultId: "result-retrieval",
      requestId: prepared.request.requestId,
      type: "source_set",
      status: "success",
      data: { text: "Current release source retrieved.", sources: [currentSource] },
      sourceIds: [currentSource.sourceId],
      uncertainties: [],
      errors: [],
      provenance: {
        provider: "test-search",
        retrievedAt: "2026-08-22T00:00:00.000Z",
        independenceKey: "provider:test-search",
        lineage: [currentSource.sourceId],
      },
      writeDisposition: "candidate_only",
    };
    const execution = ZcosUnifiedIntelligenceRuntime.wrapExecutionResult(prepared, "Release is current.", {
      sourceIds: [currentSource.sourceId],
      provider: "zillion_capital",
    });
    const verification = ZcosUnifiedIntelligenceRuntime.verifyCandidate(
      prepared,
      execution,
      [currentSource],
      [retrieval],
    );
    expect(verification.status).toBe("verified");
    expect(prepared.trace.resultIds).toEqual([retrieval.resultId, execution.resultId]);
    expect(prepared.trace.results.map((result) => result.type)).toEqual(["source_set", "execution"]);
  });

  it("parallelizes only dependency-ready, side-effect-free capabilities", () => {
    const definition = (
      id: string,
      sideEffect: ZcosCapabilityDefinition["sideEffect"],
      parallelSafe: boolean,
      dependencies: string[],
    ): ZcosCapabilityDefinition => ({
      id,
      label: id,
      ownerGalaxy: "ZCOS",
      operations: ["execute"],
      permissions: [],
      requiredIntegrations: [],
      certificationState: "certified",
      sideEffect,
      approvalRequired: false,
      parallelSafe,
      dependencies,
      artifacts: [],
      version: "1.0.0",
    });
    const registry = new ZcosCapabilityRegistry([
      definition("root", "none", false, []),
      definition("read-a", "none", true, ["root"]),
      definition("read-b", "none", true, ["root"]),
      definition("write", "internal_write", false, ["root"]),
    ]);
    const resolved = registry.resolve(["root", "read-a", "read-b", "write"], {
      permissions: new Set<ZcosPermission>(),
      configuredIntegrations: new Set(),
    });
    const capabilityByInvocation = new Map(
      resolved.invocations.map((invocation) => [invocation.invocationId, invocation.capabilityId]),
    );
    const parallelCapabilities = resolved.parallelGroups.flat().map((id) => capabilityByInvocation.get(id));
    expect(parallelCapabilities).toEqual(expect.arrayContaining(["read-a", "read-b"]));
    expect(parallelCapabilities).not.toContain("write");
  });
});
