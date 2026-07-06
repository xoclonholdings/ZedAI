import { BrainCircuit, Database, FileStack, Fingerprint, Layers } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type KnowledgeOverview = {
  coreCount: number;
  projectCount: number;
  scratchpadCount: number;
};

export type SearchResults = {
  foundation?: string;
  foundationTrace?: Array<{ title: string; source: string; excerpt: string; score: number }>;
  core?: string;
  retrieved?: any[];
  project?: any[];
  scratchpad?: any[];
};

export type ProjectMemoryDraft = {
  id: string;
  name: string;
  description: string;
  content: string;
  type: string;
  isActive: boolean;
};

export type ScratchpadDraft = { content: string; tags: string };

export type CoreMemoryDraft = {
  key: string;
  description: string;
  value: string;
  adminOnly: boolean;
};

export type FoundationProfile = {
  company: string;
  mission: string;
  products: string;
  audience: string;
  brand: string;
  principles: string;
  priorities: string;
};

export type IdentityProfile = {
  preferredName: string;
  formalName: string;
  role: string;
  relationshipToZed: string;
  ventures: string;
  operatingStyle: string;
  whoAmIAnswer: string;
  boundaries: string;
};

export type KnowledgeView = "overview" | "identity" | "project" | "scratchpad" | "core";

export const EMPTY_PROJECT_MEMORY: ProjectMemoryDraft = {
  id: "",
  name: "",
  description: "",
  content: "",
  type: "context",
  isActive: true,
};

export const EMPTY_SCRATCHPAD: ScratchpadDraft = { content: "", tags: "" };

export const EMPTY_CORE_MEMORY: CoreMemoryDraft = {
  key: "",
  description: "",
  value: "",
  adminOnly: true,
};

export const EMPTY_FOUNDATION_PROFILE: FoundationProfile = {
  company: "",
  mission: "",
  products: "",
  audience: "",
  brand: "",
  principles: "",
  priorities: "",
};

export const EMPTY_IDENTITY_PROFILE: IdentityProfile = {
  preferredName: "",
  formalName: "",
  role: "",
  relationshipToZed: "",
  ventures: "",
  operatingStyle: "",
  whoAmIAnswer: "",
  boundaries: "",
};

export const VIEW_META: Record<
  KnowledgeView,
  { label: string; description: string; icon: typeof BrainCircuit }
> = {
  overview: {
    label: "Overview",
    description: "A quick check of what Zed remembers and how well it can find things.",
    icon: BrainCircuit,
  },
  identity: {
    label: "About you",
    description: "Who Zed is talking to, and how it should answer if someone asks who you are.",
    icon: Fingerprint,
  },
  project: {
    label: "Long-term notes",
    description: "Business, product, and project facts Zed should always keep in mind.",
    icon: Database,
  },
  scratchpad: {
    label: "Working notes",
    description: "Short-term stuff from this session. Cleared regularly.",
    icon: FileStack,
  },
  core: {
    label: "Zed's foundation",
    description: "The core facts about how Zed behaves. Only touch if you know what you're changing.",
    icon: Layers,
  },
};

export function serializeFoundationProfile(profile: FoundationProfile) {
  return [
    `## Company\n${profile.company.trim() || "Not provided yet."}`,
    `## Mission\n${profile.mission.trim() || "Not provided yet."}`,
    `## Products & Ventures\n${profile.products.trim() || "Not provided yet."}`,
    `## Audience\n${profile.audience.trim() || "Not provided yet."}`,
    `## Brand Voice\n${profile.brand.trim() || "Not provided yet."}`,
    `## Operating Principles\n${profile.principles.trim() || "Not provided yet."}`,
    `## Strategic Priorities\n${profile.priorities.trim() || "Not provided yet."}`,
  ].join("\n\n");
}

function extractSection(content: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim() || "";
}

export function parseFoundationProfile(content: string): FoundationProfile {
  if (!content.includes("## ")) {
    return { ...EMPTY_FOUNDATION_PROFILE, company: content.trim() };
  }
  return {
    company: extractSection(content, "Company"),
    mission: extractSection(content, "Mission"),
    products: extractSection(content, "Products & Ventures"),
    audience: extractSection(content, "Audience"),
    brand: extractSection(content, "Brand Voice"),
    principles: extractSection(content, "Operating Principles"),
    priorities: extractSection(content, "Strategic Priorities"),
  };
}

export function serializeIdentityProfile(profile: IdentityProfile) {
  return [
    `## Preferred Name\n${profile.preferredName.trim() || "Not provided yet."}`,
    `## Formal Name\n${profile.formalName.trim() || "Not provided yet."}`,
    `## Role\n${profile.role.trim() || "Not provided yet."}`,
    `## Relationship To ZED\n${profile.relationshipToZed.trim() || "Not provided yet."}`,
    `## Ventures & Responsibilities\n${profile.ventures.trim() || "Not provided yet."}`,
    `## Operating Style\n${profile.operatingStyle.trim() || "Not provided yet."}`,
    `## Who Am I Answer\n${profile.whoAmIAnswer.trim() || "Not provided yet."}`,
    `## Boundaries\n${profile.boundaries.trim() || "Not provided yet."}`,
  ].join("\n\n");
}

export function parseIdentityProfile(content: string): IdentityProfile {
  if (!content.includes("## ")) {
    return { ...EMPTY_IDENTITY_PROFILE, whoAmIAnswer: content.trim() };
  }
  return {
    preferredName: extractSection(content, "Preferred Name"),
    formalName: extractSection(content, "Formal Name"),
    role: extractSection(content, "Role"),
    relationshipToZed: extractSection(content, "Relationship To ZED"),
    ventures: extractSection(content, "Ventures & Responsibilities"),
    operatingStyle: extractSection(content, "Operating Style"),
    whoAmIAnswer: extractSection(content, "Who Am I Answer"),
    boundaries: extractSection(content, "Boundaries"),
  };
}
