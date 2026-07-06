import type { SettingsCategory } from "./categories";

/**
 * Placeholder for categories the plain-language surface hasn't
 * covered yet. Honest about the current state (the underlying
 * behaviour is still controlled by the Ruleset tab), so the user
 * doesn't sit here waiting for controls that don't exist yet.
 */
export function ComingSoon({ category }: { category: SettingsCategory }) {
  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
          {category.label}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
          {category.description}
        </p>
      </header>

      <div className="rounded-xl border border-dashed border-white/10 p-6 text-[13px] text-white/55 leading-relaxed">
        <p className="text-white/80 font-medium">Not built yet.</p>
        <p className="mt-2 max-w-full sm:max-w-[58ch]">
          This category will land in a follow-up. Until then, the
          behaviour it describes is controlled by the raw fields in
          the{" "}
          <span className="text-white/80">Ruleset</span> tab.
        </p>
      </div>
    </div>
  );
}
