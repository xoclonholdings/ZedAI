import { BrainCircuit, Database, FileStack, Layers } from "lucide-react";

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

export type KnowledgeView = "overview" | "project" | "scratchpad" | "core";

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

export const VIEW_META: Record<
  KnowledgeView,
  { label: string; description: string; icon: typeof BrainCircuit }
> = {
  overview: {
    label: "Overview",
    description: "Inspect knowledge health and retrieval quality.",
    icon: BrainCircuit,
  },
  project: {
    label: "Project Memory",
    description: "Manage durable business and product knowledge.",
    icon: Database,
  },
  scratchpad: {
    label: "Scratchpad",
    description: "Capture and prune temporary working context.",
    icon: FileStack,
  },
  core: {
    label: "Core Memory",
    description: "Edit canonical memory entries used by ZED.",
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
