/**
 * Shared types for workspace "desks" — the working surface each
 * workspace opens into. You give ZAR a subject, ZAR grounds in that
 * workspace's memory and returns a structured, editable entry that
 * stacks up durably on the desk.
 *
 * The section labels differ per workspace (a study plan vs an ops plan vs
 * a marketing brief), but the shape is uniform so one UI renders them all.
 */

export interface WorkspaceDeskSection {
  label: string;
  items: string[];
}

export interface WorkspaceDeskEntry {
  id: string;
  createdAt: string;
  workspace: string;
  topic: string;
  summary: string;
  sections: WorkspaceDeskSection[];
  sources: string[];
  draft: boolean;
  basis: string;
}

export interface WorkspaceDeskSpec {
  /** Workspace slug. */
  workspace: string;
  /** Title shown on the desk. */
  title: string;
  /** One-line description of what the desk does. */
  blurb: string;
  /** Placeholder for the subject input. */
  placeholder: string;
  /** The label of the primary action button, e.g. "Build plan". */
  action: string;
  /** Ordered fields ZAR fills; each becomes a section. */
  fields: Array<{ key: string; label: string }>;
  /** System role framing for the model. */
  systemRole: string;
}

export const WORKSPACE_DESK_SPECS: Record<string, WorkspaceDeskSpec> = {
  education: {
    workspace: "education",
    title: "Study desk",
    blurb: "Give ZAR a subject. It builds a study plan and practice you can work through — grounded in what you've taught it here.",
    placeholder: "e.g. Options greeks for beginners",
    action: "Build study plan",
    systemRole:
      "You are ZAR's learning coach. You build clear, honest study plans and practice from what the learner already knows. You never fabricate facts.",
    fields: [
      { key: "keyConcepts", label: "Key concepts" },
      { key: "learningPath", label: "Learning path (in order)" },
      { key: "practiceQuestions", label: "Practice questions" },
      { key: "commonMistakes", label: "Common mistakes" },
      { key: "nextSteps", label: "Next steps" },
    ],
  },
  operations: {
    workspace: "operations",
    title: "Ops desk",
    blurb: "Describe what needs to get done. ZAR turns it into a working plan — grounded in this workspace's knowledge.",
    placeholder: "e.g. Launch the new onboarding flow by end of month",
    action: "Build plan",
    systemRole:
      "You are ZAR's operations planner. You turn objectives into concrete, sequenced plans with owners and risks. You are honest about unknowns.",
    fields: [
      { key: "objective", label: "Objective" },
      { key: "steps", label: "Steps (in order)" },
      { key: "owners", label: "Owners / roles" },
      { key: "risks", label: "Risks & blockers" },
      { key: "milestones", label: "Milestones" },
    ],
  },
  // No "marketing" entry: marketing folded into Operations (see workspace.tsx)
  // rather than staying a peer desk — a duplicate desk here under the old
  // "marketing" slug would silently ignore the Operations merge and keep
  // writing to a separate memory scope.
};
