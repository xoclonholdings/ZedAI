import type { ReactNode } from "react";

/**
 * Reusable atoms for the plain-language Settings surface.
 *
 * Every row is: label + one-line description on the left, standard
 * control on the right. Groups get an uppercase eyebrow label + a
 * hairline top border. This is the visual language from the design
 * mock — every new Settings section should be built from these.
 */

// ─── Row + group ─────────────────────────────────────────────────

export function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-7 mt-7 border-t border-white/[0.06] first:pt-0 first:mt-0 first:border-t-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 mb-4">
        {title}
      </div>
      {children}
    </section>
  );
}

export function SettingRow({
  label,
  description,
  children,
  stack = false,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  /** For controls that need the full width (e.g. textareas). */
  stack?: boolean;
}) {
  if (stack) {
    return (
      <div className="py-3.5 border-t border-white/[0.06] first:border-t-0">
        <div>
          <label className="block text-[14.5px] font-medium text-white/90">{label}</label>
          {description && (
            <p className="mt-0.5 text-[13px] text-white/50 max-w-[58ch] leading-snug">
              {description}
            </p>
          )}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 items-center py-3.5 border-t border-white/[0.06] first:border-t-0">
      <div>
        <label className="block text-[14.5px] font-medium text-white/90">{label}</label>
        {description && (
          <p className="mt-0.5 text-[13px] text-white/50 max-w-[58ch] leading-snug">
            {description}
          </p>
        )}
      </div>
      <div className="justify-self-end">{children}</div>
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
      className={`relative inline-flex w-10 h-[22px] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
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
      className="inline-flex bg-white/[0.04] border border-white/10 rounded-lg p-[3px] gap-[2px]"
    >
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-[5px] text-[13px] rounded-md transition-colors ${
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
      style={{ minWidth }}
      className="appearance-none bg-white/[0.04] border border-white/10 rounded-lg text-[13.5px] text-white px-3 py-2 pr-8 cursor-pointer hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
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
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-40 h-[22px] appearance-none bg-transparent cursor-pointer settings-range"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <span className="tabular-nums text-[12.5px] text-white/60 min-w-[32px] text-right">
          {value}
        </span>
      </div>
      <div className="flex justify-between w-40 mt-1 text-[11px] tracking-[0.04em] text-white/40 uppercase">
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
      className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 leading-snug resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
    />
  );
}

// ─── Save indicator ───────────────────────────────────────────────

export function SaveIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
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
      label: "Couldn’t save",
      text: "text-red-300/80",
    },
  };
  const cur = map[status];
  return (
    <div className={`flex items-center gap-2 text-[12px] ${cur.text}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${cur.dot} shadow-[0_0_0_3px_rgba(34,211,238,0.14)]`}
      />
      {cur.label}
    </div>
  );
}
