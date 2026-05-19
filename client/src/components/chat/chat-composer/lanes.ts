import type { AgentTarget, ConversationMode } from "@shared/schema";

export type LaneOption = {
  key: "chat" | AgentTarget;
  mode: ConversationMode;
  agent?: AgentTarget;
  label: string;
  blurb: string;
};

export const LANE_OPTIONS: LaneOption[] = [
  { key: "chat", mode: "chat", label: "Chat", blurb: "Direct conversation, no orchestration." },
  {
    key: "operations",
    mode: "agent",
    agent: "operations",
    label: "Operations",
    blurb: "Day-to-day ops, scheduling, routing.",
  },
  {
    key: "research",
    mode: "agent",
    agent: "research",
    label: "R&D",
    blurb: "Research, intelligence, synthesis.",
  },
  {
    key: "business",
    mode: "agent",
    agent: "business",
    label: "Business",
    blurb: "Commerce, property, planning.",
  },
  {
    key: "finance",
    mode: "agent",
    agent: "finance",
    label: "Finance",
    blurb: "Money, payroll, markets.",
  },
];
