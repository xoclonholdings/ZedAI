import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Reusable atoms for the plain-language Settings surface.
 *
 * Every row is: label + one-line description on the left, standard
 * control on the right. Groups get an uppercase eyebrow label + a
 * hairline top border. This is the visual language from the design
 * mock — every new Settings section should be built from these.
 */

// ─── Row + group ─────────────────────────────────────────────────

interface SettingGroupProps {
  title: string;
  children: ReactNode;
  /** When true, the group can be collapsed. Useful for long lists. */
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible`. Ignored otherwise. */
  defaultCollapsed?: boolean;
  /** Optional item count shown next to the title. */
  count?: number;
}

export function SettingGroup({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  count,
}: SettingGroupProps) {
  const [collapsed, setCollapsed] = useState<boolean>(collapsible && defaultCollapsed);

  const eyebrow = (
    <div className="mb-4 flex min-w-0 max-w-full items-center gap-2">
      <span className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 [overflow-wrap:anywhere]">
        {title}
      </span>
      {typeof count === "number" && (
        <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-white/30">
          · {count}
        </span>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <section className="mt-7 w-full min-w-0 max-w-full border-t border-white/[0.06] pt-7 first:mt-0 first:border-t-0 first:pt-0">
        {eyebrow}
        {children}
      </section>
    );
  }

  return (
    <section className="mt-7 w-full min-w-0 max-w-full border-t border-white/[0.06] pt-7 first:mt-0 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="group mb-4 flex w-full min-w-0 max-w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 transition-colors [overflow-wrap:anywhere] group-hover:text-white/60">
            {title}
          </span>
          {typeof count === "number" && (
            <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-white/30">
              · {count}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-white/30 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  /** Force stack layout (label above control). Overrides mobile auto-stack. */
  stack?: boolean;
}

export function SettingRow({ label, description, children, stack = false }: SettingRowProps) {
  if (stack) {
    return (
      <div className="w-full min-w-0 max-w-full border-t border-white/[0.06] py-3.5 first:border-t-0">
        <div className="min-w-0 max-w-full">
          <label className="block min-w-0 break-words text-[14.5px] font-medium text-white/90 [overflow-wrap:anywhere]">{label}</label>
          {description && (
            <p className="mt-0.5 max-w-full break-words text-[13px] leading-snug text-white/50 [overflow-wrap:anywhere] sm:max-w-[58ch]">
              {description}
            </p>
          )}
        </div>
        <div className="mt-3 w-full min-w-0 max-w-full">{children}</div>
      </div>
    );
  }
  // On <sm: stack (label above, control below). On sm+: side-by-side.
  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3 border-t border-white/[0.06] py-3.5 first:border-t-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0 max-w-full">
        <label className="block min-w-0 break-words text-[14.5px] font-medium text-white/90 [overflow-wrap:anywhere]">{label}</label>
        {description && (
          <p className="mt-0.5 max-w-full break-words text-[13px] leading-snug text-white/50 [overflow-wrap:anywhere] sm:max-w-[58ch]">
            {description}
          </p>
        )}
      </div>
      <div className="w-full min-w-0 max-w-full sm:w-auto sm:justify-self-end">{children}</div>
    </div>
  );
}

// ─── Controls ────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-10 h-[22px] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 active:opacity-80 ${
        checked ? "bg-cyan-400" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : ""
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex w-full min-w-0 max-w-full gap-[2px] rounded-lg border border-white/10 bg-white/[0.04] p-[3px] sm:inline-flex sm:w-auto"
    >
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={on}
            className={`min-w-0 flex-1 break-words px-2 py-[5px] text-center text-[13px] rounded-md transition-colors active:opacity-80 [overflow-wrap:anywhere] sm:flex-none sm:whitespace-nowrap sm:px-3 ${
              on
                ? "bg-black text-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function LabeledSelect<T extends string>({
  value,
  onChange,
  options,
  minWidth = 180,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  minWidth?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{ ["--select-min-width" as string]: `${minWidth}px` }}
      className="w-full min-w-0 max-w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 pr-8 text-[13.5px] text-white cursor-pointer hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 sm:w-auto sm:min-w-[var(--select-min-width)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-neutral-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LabeledSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  leftLabel,
  rightLabel,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  leftLabel: string;
  rightLabel: string;
  ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-start sm:max-w-[240px]">
      <div className="flex w-full items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-[22px] min-w-0 flex-1 appearance-none bg-transparent cursor-pointer settings-range"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <span className="tabular-nums text-[12.5px] text-white/60 min-w-[32px] text-right">
          {value}
        </span>
      </div>
      <div className="mt-1 flex w-[calc(100%-44px)] max-w-full justify-between text-[11px] uppercase tracking-[0.04em] text-white/40">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <style>{`
        .settings-range::-webkit-slider-runnable-track {
          height: 4px;
          background: linear-gradient(to right, rgb(34 211 238) var(--pct, 0%), rgba(255,255,255,0.14) var(--pct, 0%));
          border-radius: 999px;
        }
        .settings-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 999px;
          margin-top: -6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.35);
        }
        .settings-range::-moz-range-track {
          height: 4px;
          background: rgba(255,255,255,0.14);
          border-radius: 999px;
        }
        .settings-range::-moz-range-progress {
          height: 4px;
          background: rgb(34 211 238);
          border-radius: 999px;
        }
        .settings-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #fff;
          border: none;
          border-radius: 999px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.35);
        }
        .settings-range:focus-visible {
          outline: none;
        }
        .settings-range:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(34,211,238,0.35), 0 1px 3px rgba(0,0,0,0.35);
        }
      `}</style>
    </div>
  );
}

export function PlainTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 5,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
      className="w-full min-w-0 max-w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] leading-snug text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
    />
  );
}

// ─── Save indicator ───────────────────────────────────────────────

export function SaveIndicator({
  status,
  errorMessage,
}: {
  status: "idle" | "saving" | "saved" | "error";
  errorMessage?: string;
}) {
  const map: Record<typeof status, { dot: string; label: string; text: string }> = {
    idle: {
      dot: "bg-cyan-400/60",
      label: "Changes save automatically",
      text: "text-white/40",
    },
    saving: {
      dot: "bg-cyan-400 animate-pulse",
      label: "Saving…",
      text: "text-white/60",
    },
    saved: {
      dot: "bg-emerald-400",
      label: "Saved",
      text: "text-emerald-300/80",
    },
    error: {
      dot: "bg-red-400",
      label: errorMessage || "Couldn’t save",
      text: "text-red-300/80",
    },
  };
  const cur = map[status];
  return (
    <div
      className={`flex min-w-0 max-w-full items-center gap-2 text-[12px] ${cur.text}`}
      role={status === "error" ? "alert" : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cur.dot} shadow-[0_0_0_3px_rgba(34,211,238,0.14)]`}
      />
      <span className="truncate">{cur.label}</span>
    </div>
  );
}

// ─── Section header row ───────────────────────────────────────────

/**
 * Callout used above sensitive sections when the initial load
 * couldn't reach the server. Makes the "you're on defaults" state
 * visible instead of silently letting the user tweak DEFAULTS that
 * won't persist.
 */
export function LoadErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-6 flex w-full min-w-0 max-w-full items-start justify-between gap-3 rounded-lg border border-red-400/30 bg-red-500/[0.06] px-3.5 py-3"
    >
      <div className="min-w-0 max-w-full">
        <div className="break-words text-[13px] font-medium text-red-200 [overflow-wrap:anywhere]">
          Couldn’t load your current settings
        </div>
        <div className="mt-0.5 break-words text-[12.5px] leading-snug text-red-200/70 [overflow-wrap:anywhere]">
          You’re looking at defaults. Changes may not save until you retry.
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 text-[12.5px] font-medium text-red-100 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-md px-2.5 py-1"
      >
        Retry
      </button>
    </div>
  );
}
