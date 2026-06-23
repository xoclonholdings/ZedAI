import { Sparkles, Zap } from "lucide-react";
import { zedLogoSrc as zLogoPath } from "@/lib/zedLogo";

interface ChatEmptyStateProps {
  onSelectSuggestion: (prompt: string) => void;
}

const SUGGESTIONS = [
  "Summarize what's currently on my plate.",
  "Research my competitors and tell me the next move.",
  "Build a clean launch plan for ZWAP.",
  "Draft a short status update I can send to the team.",
];

export default function ChatEmptyState({ onSelectSuggestion }: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <img src={zLogoPath} alt="Z" className="h-7 w-7" />
          <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            ZED
          </span>
        </div>
        <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
          Tell ZED the outcome you need. Agents, tools, memory, flows, approvals, and reports
          stay behind the interface.
        </p>

        <div className="mb-4 inline-flex items-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
          <Sparkles size={11} className="mr-1.5 text-cyan-400" />
          Try one
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectSuggestion(prompt)}
              className="group rounded-xl border border-fuchsia-500/30 bg-white/[0.03] px-3 py-2.5 text-left text-xs leading-snug text-foreground/90 transition-all hover:border-white/20 hover:bg-white/[0.06] sm:text-[13px]"
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
