/**
 * Shared types for workspace "desks" — the working surface each
 * workspace opens into. You give Zed a subject, Zed grounds in that
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
  /** Ordered fields Zed fills; each becomes a section. */
  fields: Array<{ key: string; label: string }>;
  /** System role framing for the model. */
  systemRole: string;
}

export const WORKSPACE_DESK_SPECS: Record<string, WorkspaceDeskSpec> = {
  education: {
    workspace: "education",
    title: "Study desk",
    blurb: "Give Zed a subject. It builds a study plan and practice you can work through — grounded in what you've taught it here.",
    placeholder: "e.g. Options greeks for beginners",
    action: "Build study plan",
    systemRole:
      "You are Zed's learning coach. You build clear, honest study plans and practice from what the learner already knows. You never fabricate facts.",
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
    blurb: "Describe what needs to get done. Zed turns it into a working plan — grounded in this workspace's knowledge.",
    placeholder: "e.g. Launch the new onboarding flow by end of month",
    action: "Build plan",
    systemRole:
      "You are Zed's operations planner. You turn objectives into concrete, sequenced plans with owners and risks. You are honest about unknowns.",
    fields: [
      { key: "objective", label: "Objective" },
      { key: "steps", label: "Steps (in order)" },
      { key: "owners", label: "Owners / roles" },
      { key: "risks", label: "Risks & blockers" },
      { key: "milestones", label: "Milestones" },
    ],
  },
  marketing: {
    workspace: "marketing",
    title: "Marketing desk",
    blurb: "Say what you're promoting and to whom. Zed drafts a working brief — grounded in this workspace's knowledge.",
    placeholder: "e.g. Promote the AI trading tool to retail traders",
    action: "Build brief",
    systemRole:
      "You are Zed's marketing strategist. You produce practical briefs — angles, audiences, channels, and content ideas. You never promise results or invent metrics.",
    fields: [
      { key: "audiences", label: "Audiences" },
      { key: "angles", label: "Angles / messaging" },
      { key: "channels", label: "Channels" },
      { key: "contentIdeas", label: "Content ideas" },
      { key: "callToAction", label: "Calls to action" },
    ],
  },
};
