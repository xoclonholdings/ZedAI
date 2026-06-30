/**
 * Renders an IntelligenceAgent result into mobile-readable markdown.
 * The default shape avoids exposing source-trail machinery; sources are
 * included only when the user explicitly asks for them.
 */
export function formatBrief(
  brief: any,
  options: { includeSources?: boolean } = {},
): string {
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

  const nextStep =
    brief?.recommendedAction &&
    !/review findings|determine next steps/i.test(brief.recommendedAction)
      ? brief.recommendedAction
      : "Tell me whether you want the short action plan, sources, or a deeper pass.";

  const sources = Array.isArray(brief?.sources)
    ? brief.sources.filter(Boolean)
    : [];
  const sourceSection =
    options.includeSources && sources.length > 0
      ? `\n\n### Sources\n\n${sources.map((source: string) => `- ${source}`).join("\n")}`
      : "";

  return `${directAnswer}

### What matters

${pointLines}

### What I'd do next

${nextStep}${sourceSection}`;
}
