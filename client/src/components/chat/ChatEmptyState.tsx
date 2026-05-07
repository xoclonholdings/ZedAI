import { Sparkles, Zap } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";
import type { AgentTarget, ConversationMode } from "@shared/schema";

interface ChatEmptyStateProps {
  currentMode: ConversationMode;
  agentTarget: AgentTarget;
  onSelectSuggestion: (prompt: string) => void;
}

interface AgentProfile {
  label: string;
  blurb: string;
  accent: string;
  ringColor: string;
  suggestions: string[];
}

const AGENTS: Record<string, AgentProfile> = {
  chat: {
    label: "ZED",
    blurb: "Conversational mode. Ask anything, plan anything, draft anything.",
    accent: "from-pink-500 via-fuchsia-500 to-cyan-400",
    ringColor: "border-fuchsia-500/30",
    suggestions: [
      "Summarize what's currently on my plate.",
      "Explain how Zed's task lifecycle works in two sentences.",
      "Draft a short status update I can send to the team.",
    ],
  },
  finance: {
    label: "Finance",
    blurb: "Crypto, forex, trading setups, wealth strategy. Action-gated.",
    accent: "from-emerald-300 via-emerald-400 to-cyan-400",
    ringColor: "border-emerald-400/30",
    suggestions: [
      "Walk me through a current BTC swing-trade thesis.",
      "Compare ETH and SOL on-chain activity over the last week.",
      "Suggest a conservative risk-managed entry for EUR/USD.",
      "What's the smartest way to compound idle stablecoin yield?",
    ],
  },
  operations: {
    label: "Operations",
    blurb: "Calendars, email, scheduling, real-world execution. Approval-gated.",
    accent: "from-cyan-300 via-cyan-400 to-blue-500",
    ringColor: "border-cyan-400/30",
    suggestions: [
      "Draft a polite email cancelling my gym membership effective immediately.",
      "Schedule a 30-minute meeting next week with the design team.",
      "Reschedule today's 3pm to Thursday morning and send a note.",
      "Reply to the latest invoice email asking for a Net-15 term.",
    ],
  },
  research: {
    label: "R&D",
    blurb: "Research, market scans, comparisons, deep summaries.",
    accent: "from-violet-400 via-purple-500 to-fuchsia-500",
    ringColor: "border-violet-500/30",
    suggestions: [
      "Compare three top alternatives to Notion for project planning.",
      "Summarize what's happening with crypto regulation this month.",
      "Brief me on the latest open-source LLM releases worth trying.",
      "What are the biggest risks in this market right now?",
    ],
  },
  business: {
    label: "Business Manager",
    blurb: "Payroll, contractors, ecommerce, real estate, business credit.",
    accent: "from-amber-300 via-orange-400 to-rose-500",
    ringColor: "border-amber-400/30",
    suggestions: [
      "Draft an onboarding plan for a new 1099 contractor.",
      "Outline a 90-day plan to launch a small dropshipping store.",
      "Walk me through stacking business credit responsibly.",
      "Pull the highlights from my last payroll run.",
    ],
  },
};

function profileFor(mode: ConversationMode, target: AgentTarget): AgentProfile {
  if (mode === "chat") return AGENTS.chat;
  return AGENTS[target] || AGENTS.operations;
}

export default function ChatEmptyState({
  currentMode,
  agentTarget,
  onSelectSuggestion,
}: ChatEmptyStateProps) {
  const profile = profileFor(currentMode, agentTarget);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <img src={zLogoPath} alt="Z" className="h-7 w-7" />
          <span
            className={`bg-gradient-to-r ${profile.accent} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}
          >
            {profile.label}
          </span>
        </div>
        <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">{profile.blurb}</p>

        <div className="mb-4 inline-flex items-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
          <Sparkles size={11} className="mr-1.5 text-cyan-400" />
          Try one
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {profile.suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectSuggestion(prompt)}
              className={`group rounded-xl border ${profile.ringColor} bg-white/[0.03] px-3 py-2.5 text-left text-xs leading-snug text-foreground/90 transition-all hover:bg-white/[0.06] hover:border-white/20 sm:text-[13px]`}
            >
              <span className="block">{prompt}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground/70 group-hover:text-cyan-300/80">
                Click to use
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center text-[11px] text-muted-foreground/60">
          <Zap size={11} className="mr-1.5 text-cyan-400" />
          Or just start typing
        </div>
      </div>
    </div>
  );
}
