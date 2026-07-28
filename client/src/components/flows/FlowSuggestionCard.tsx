import { useState } from "react";
import { Sparkles, X } from "lucide-react";

export interface FlowSuggestion {
  id: string;
  suggestedName: string;
  suggestedBlurb: string;
  suggestedCategory: string;
  occurrences: number;
  lastSeenAt: string;
  examples: string[];
}

const CATEGORY_OPTIONS = [
  "custom", "business", "research", "content", "learning", "product", "development",
  "marketing", "sales", "finance", "operations", "personal_development", "planning",
  "strategy", "execution", "revenue", "partnership", "project", "social", "pr", "security",
];

function friendlyCategory(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * ZAR noticed you've asked for basically the same thing more than once -
 * this card lets you turn that repeated request into a real one-tap Flow
 * instead of retyping it every time.
 */
export function FlowSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  busy,
}: {
  readonly suggestion: FlowSuggestion;
  readonly onAccept: (input: { name: string; category: string; blurb: string }) => void;
  readonly onDismiss: () => void;
  readonly busy?: boolean;
}) {
  const [name, setName] = useState(suggestion.suggestedName);
  const [category, setCategory] = useState(suggestion.suggestedCategory);

  return (
    <div className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.04] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-violet-200/80">
          <Sparkles size={13} />
          ZAR noticed a pattern
        </div>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          aria-label="Dismiss suggestion"
          className="text-white/40 hover:text-white/70 disabled:opacity-40"
        >
          <X size={14} />
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-white/70">
        You've asked for this <span className="font-semibold text-white">{suggestion.occurrences} times</span> recently:
      </p>
      <p className="mt-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12.5px] italic text-white/60">
        "{suggestion.examples[0]}"
      </p>

      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Shortcut name"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white focus:border-violet-400/50 focus:outline-none"
          aria-label="Shortcut category"
        >
          {CATEGORY_OPTIONS.map((value) => (
            <option key={value} value={value} className="bg-black">
              {friendlyCategory(value)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => onAccept({ name: name.trim() || suggestion.suggestedName, category, blurb: suggestion.suggestedBlurb })}
        disabled={busy || !name.trim()}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-3 py-2.5 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add to Flows"}
      </button>
    </div>
  );
}
