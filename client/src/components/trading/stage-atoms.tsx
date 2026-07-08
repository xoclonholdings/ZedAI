import { RefreshCw } from "lucide-react";

/**
 * Shared building blocks for the Trading stage workspaces
 * (LearnStage, StrategyStage, ValidationStage, SandboxWorkspace).
 */

export function StageShell({
  eyebrow,
  title,
  description,
  onRefresh,
  refreshing,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-400/80 mb-1">
            {eyebrow}
          </div>
          <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">
            {title}
          </h2>
          <p className="mt-1 text-[12.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

export function GroupHeading({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
      {label} ({count})
    </div>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-dashed border-white/10 p-5 text-center text-[12.5px] text-white/40">
      {children}
    </div>
  );
}

export function NoticeBanner({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const cls =
    kind === "success"
      ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
      : "border-red-400/30 bg-red-400/5 text-red-200";
  return (
    <div className={`mb-4 rounded-lg border px-3 py-2 text-[12.5px] ${cls}`}>
      {children}
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30";

export const textareaClass =
  "w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 leading-snug resize-y placeholder:text-white/30";
