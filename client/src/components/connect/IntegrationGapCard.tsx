import { ExternalLink, KeyRound, Sparkles, X } from "lucide-react";

export interface IntegrationGap {
  id: string;
  categoryId: string;
  label: string;
  matchedText: string;
  signupUrl?: string;
  occurrences: number;
  lastSeenAt: string;
}

/**
 * ZAR noticed you actually asked for something that needs this integration,
 * and it isn't connected yet. Real signal (see IntegrationGapEngine), not a
 * generic upsell list.
 */
export function IntegrationGapCard({
  gap,
  isAdmin,
  onManage,
  onAddCredentials,
  onDismiss,
}: {
  readonly gap: IntegrationGap;
  readonly isAdmin: boolean;
  readonly onManage: () => void;
  readonly onAddCredentials: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-amber-200/80">
          <Sparkles size={13} />
          ZAR needs {gap.label}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-white/40 hover:text-white/70"
        >
          <X size={14} />
        </button>
      </div>

      <p className="mt-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12.5px] italic text-white/60">
        "{gap.matchedText}"
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {gap.signupUrl && (
          <a
            href={gap.signupUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/80 transition-colors hover:bg-white/[0.08]"
          >
            <ExternalLink size={13} />
            Sign up
          </a>
        )}
        {isAdmin ? (
          <button
            type="button"
            onClick={onManage}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Add credentials
          </button>
        ) : (
          <button
            type="button"
            onClick={onAddCredentials}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90"
          >
            <KeyRound size={13} />
            Add my credentials
          </button>
        )}
      </div>
    </div>
  );
}
