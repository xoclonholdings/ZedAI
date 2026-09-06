import type {
  ZcosExecutionPlan,
  ZcosRequestEnvelope,
  ZcosResultEnvelope,
  ZcosSourceEnvelope,
  ZcosUncertaintyEnvelope,
} from "../../../shared/zcos-intelligence";
import { ZCOS_INTELLIGENCE_SCHEMA_VERSION } from "../../../shared/zcos-intelligence";

const RESULT_TYPES = new Set(["context", "source_set", "execution", "verification", "error"]);
const RESULT_STATUSES = new Set(["success", "partial", "blocked", "failed"]);
const WRITE_DISPOSITIONS = new Set(["read_only", "candidate_only", "approved_mutation"]);
const SOURCE_TYPES = new Set(["identity", "conversation_history", "memory", "knowledge", "learning", "project", "file", "external_url", "external_search", "external_model"]);
const SOURCE_AUTHORITIES = new Set(["canonical", "source", "candidate"]);
const SOURCE_GALAXIES = new Set(["ZCOS", "ZAR", "ZYNC", "ZENA", "ZENO", "ZYLO", "ZWAP!", "ZENITH", "ZILLION"]);
const SOURCE_ORIGINS = new Set(["internal_canonical", "user_supplied", "external_primary", "external_secondary", "model_synthesis"]);
const SOURCE_CURRENCIES = new Set(["current", "review_due", "potentially_outdated", "historical", "unknown"]);

function assertSource(source: ZcosSourceEnvelope): void {
  if (!source || typeof source !== "object" || !source.sourceId?.trim()) throw new Error("Source envelope requires sourceId.");
  if (
    !SOURCE_TYPES.has(source.type) ||
    !SOURCE_AUTHORITIES.has(source.authority) ||
    !SOURCE_GALAXIES.has(source.originGalaxy) ||
    !SOURCE_ORIGINS.has(source.originClass) ||
    !SOURCE_CURRENCIES.has(source.currency)
  ) throw new Error(`Source ${source.sourceId} has invalid ownership/type metadata.`);
  if (!Number.isFinite(source.confidence) || source.confidence < 0 || source.confidence > 1) throw new Error(`Source ${source.sourceId} has invalid confidence.`);
  if (!source.provenance?.retrievedAt || !source.provenance?.independenceKey?.trim() || !Array.isArray(source.provenance?.lineage)) {
    throw new Error(`Source ${source.sourceId} has incomplete provenance.`);
  }
}

export class ZcosPolicyEngine {
  static preflight(request: ZcosRequestEnvelope, plan: ZcosExecutionPlan): ZcosUncertaintyEnvelope[] {
    const uncertainties: ZcosUncertaintyEnvelope[] = [];
    if (!request.permissions.externalRetrieval && plan.externalRetrievalRequired) {
      uncertainties.push({
        code: "external_retrieval_not_authorized",
        statement: "Current external sources are required but external retrieval is not authorized.",
        material: true,
        confidence: 1,
        sourceIds: [],
        resolution: "block_action",
      });
    }
    for (const invocation of plan.invocations) {
      if (invocation.sideEffect === "external_write" && invocation.status !== "approved") {
        uncertainties.push({
          code: "external_action_requires_approval",
          statement: `${invocation.capabilityId} cannot execute without action-specific approval.`,
          material: true,
          confidence: 1,
          sourceIds: [],
          resolution: "block_action",
        });
      }
    }
    return uncertainties;
  }

  static verifyExternalResult(
    result: ZcosResultEnvelope,
    sources: ZcosSourceEnvelope[],
    expectedRequestId?: string,
  ): void {
    if (!result || typeof result !== "object") throw new Error("External result envelope is required.");
    if (result.schemaVersion !== ZCOS_INTELLIGENCE_SCHEMA_VERSION) throw new Error(`Unsupported result schema: ${String(result.schemaVersion)}.`);
    if (!result.resultId?.trim() || !result.requestId?.trim()) throw new Error("External result requires resultId and requestId.");
    if (expectedRequestId && result.requestId !== expectedRequestId) throw new Error("External result requestId does not match the governed request.");
    if (!RESULT_TYPES.has(result.type) || !RESULT_STATUSES.has(result.status)) throw new Error("External result has an invalid type or status.");
    if (!Array.isArray(result.sourceIds) || !Array.isArray(result.uncertainties) || !Array.isArray(result.errors)) throw new Error("External result arrays are malformed.");
    if (!WRITE_DISPOSITIONS.has(result.writeDisposition)) throw new Error("External result has an invalid write disposition.");
    if (!result.provenance?.retrievedAt || !result.provenance?.independenceKey?.trim() || !Array.isArray(result.provenance?.lineage)) {
      throw new Error("External result has incomplete provenance.");
    }
    if (result.writeDisposition === "approved_mutation") {
      throw new Error("External intelligence adapters cannot write canonical ZCOS state.");
    }
    for (const source of sources) assertSource(source);
    const allowedSourceIds = new Set(sources.map((source) => source.sourceId));
    for (const sourceId of result.sourceIds) {
      if (!allowedSourceIds.has(sourceId)) throw new Error(`External result cites unknown source: ${sourceId}`);
    }
  }
}
