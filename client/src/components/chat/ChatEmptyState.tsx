interface ChatEmptyStateProps {
  onSelectSuggestion: (prompt: string) => void;
}

const SHORTCUTS: Array<{ label: string; prompt: string }> = [
  { label: "What's on my plate", prompt: "What's on my plate right now?" },
  { label: "Log a decision", prompt: "Log a decision:" },
  { label: "Draft it, don't send", prompt: "Draft this and don't send it yet:" },
  { label: "Check the numbers", prompt: "Check the numbers on" },
];

export default function ChatEmptyState({ onSelectSuggestion }: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.22em] text-cyan-400/80">
          On.
        </div>
        <div className="text-[22px] leading-tight font-semibold text-foreground tracking-tight">
          What are we doing?
        </div>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
          Say the outcome. I'll handle the mechanics.
        </p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSelectSuggestion(s.prompt)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/20 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
