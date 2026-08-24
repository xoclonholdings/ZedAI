import type {
  ZcosConfluenceReport,
  ZcosSourceEnvelope,
  ZcosUncertaintyEnvelope,
} from "../../../shared/zcos-intelligence";

export class SourceConfluenceEngine {
  static evaluate(sources: ZcosSourceEnvelope[]): {
    report: ZcosConfluenceReport;
    uncertainties: ZcosUncertaintyEnvelope[];
  } {
    const independenceKeys = new Set(sources.map((source) => source.provenance.independenceKey));
    const claimValues = new Map<string, Map<string, Set<string>>>();

    for (const source of sources) {
      for (const claim of source.claims || []) {
        const claimKey = claim.key.trim().toLowerCase();
        const value = claim.value.trim();
        if (!claimKey || !value) continue;
        const key = `${claimKey}::${claim.scope || "default"}`;
        const byValue = claimValues.get(key) || new Map<string, Set<string>>();
        const sourceIds = byValue.get(value) || new Set<string>();
        sourceIds.add(source.sourceId);
        byValue.set(value, sourceIds);
        claimValues.set(key, byValue);
      }
    }

    const conflicts = [...claimValues.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([claimKey, values]) => ({
        claimKey,
        values: [...values.entries()].map(([value, sourceIds]) => ({ value, sourceIds: [...sourceIds] })),
      }));
    const uncertainties: ZcosUncertaintyEnvelope[] = conflicts.map((conflict) => ({
      code: "source_conflict",
      statement: `Sources preserve conflicting values for ${conflict.claimKey}.`,
      material: true,
      confidence: 1,
      sourceIds: conflict.values.flatMap((value) => value.sourceIds),
      resolution: "preserve",
    }));
    const averageConfidence = sources.length
      ? sources.reduce((sum, source) => sum + Math.max(0, Math.min(1, source.confidence)), 0) / sources.length
      : 0;
    const independenceFactor = sources.length ? independenceKeys.size / sources.length : 0;
    const conflictPenalty = conflicts.length > 0 ? 0.25 : 0;

    return {
      report: {
        independentSourceCount: independenceKeys.size,
        duplicateLineageCount: Math.max(0, sources.length - independenceKeys.size),
        conflicts,
        confidence: Number(Math.max(0, Math.min(1, averageConfidence * (0.7 + 0.3 * independenceFactor) - conflictPenalty)).toFixed(2)),
      },
      uncertainties,
    };
  }
}
