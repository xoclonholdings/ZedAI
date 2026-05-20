/**
 * Renders an IntelligenceAgent research brief into the markdown the
 * chat surface displays. Defensive about missing fields because the
 * shape can vary depending on which research depth ran.
 */
export function formatBrief(brief: any): string {
  const keyFindings = Array.isArray(brief?.keyFindings) ? brief.keyFindings : [];
  const findings =
    keyFindings.length > 0
      ? keyFindings.map((finding: string) => `- ${finding}`).join("\n")
      : "- No key findings returned.";

  return `**Research Brief: ${brief?.topic || "Research"}**

**Confidence**: ${brief?.confidence || "unknown"}

**Key Findings**:
${findings}

**Implications**: ${brief?.implications || "No implications returned."}

**Recommended Action**: ${brief?.recommendedAction || "No recommended action returned."}`;
}
