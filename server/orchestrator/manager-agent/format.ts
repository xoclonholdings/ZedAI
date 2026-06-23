/**
 * Renders an IntelligenceAgent result into mobile-readable markdown.
 * The user-facing shape intentionally avoids stiff report labels.
 */
export function formatBrief(brief: any): string {
  const points = Array.isArray(brief?.keyFindings)
    ? brief.keyFindings.filter(Boolean)
    : [];
  const pointLines =
    points.length > 0
      ? points.map((finding: string) => `- ${finding}`).join("\n")
      : "- I could not pull out clean supporting points from the model response.";

  const directAnswer =
    points[0] ||
    brief?.implications ||
    `I checked ${brief?.topic || "the request"} and found enough to give you a direction.`;

  const sources = Array.isArray(brief?.sources)
    ? brief.sources.filter(Boolean)
    : [];
  const sourceLines = sources.length > 0
    ? sources.map((source: string) => `- ${source}`).join("\n")
    : "- No external source trail was recorded.";

  const nextStep =
    brief?.recommendedAction &&
    !/review findings|determine next steps/i.test(brief.recommendedAction)
      ? brief.recommendedAction
      : "Tell me whether you want the short action plan, the source trail, or a deeper pass.";

  return `${directAnswer}

### What matters

${pointLines}

### What I'd do next

${nextStep}

### Source trail

${sourceLines}`;
}
