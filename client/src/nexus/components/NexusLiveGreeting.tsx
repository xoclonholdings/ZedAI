import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

type PartOfDay = "morning" | "afternoon" | "evening";

interface QuoteEntry {
  readonly quote: string;
  /** Shown in the "more" popup - a concrete way to actually act on the affirmation, not just restate it. */
  readonly tip: string;
}

/** Exactly one entry per part of day - not a rotating pool, per the "only 3 quotes a day" spec. */
const PART_OF_DAY_QUOTE: Record<PartOfDay, QuoteEntry> = {
  morning: {
    quote: "Small steps compound into orbit.",
    tip: "Pick one small, concrete action you can finish in the next 10 minutes, and do only that - momentum compounds faster than plans do.",
  },
  afternoon: {
    quote: "Clarity first, velocity second.",
    tip: "Before you speed up, write one sentence describing exactly what “done” looks like right now. Moving fast toward the wrong target just wastes the afternoon.",
  },
  evening: {
    quote: "The mission continues whether you feel ready or not.",
    tip: "Close out one small open loop before you stop tonight - even an imperfectly finished thing beats a perfectly unfinished one.",
  },
};

const CLOCK_TICK_MS = 15000;

function partOfDay(date: Date): PartOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateLine(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${weekday}, ${monthDay}`;
}

/** Shared clock tick + part-of-day, so the clock row and the quote row (rendered in separate header slots) always agree. */
function useNexusLiveMoment() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return { now, part: partOfDay(now) };
}

/**
 * The console's live time + date - confined to a narrow column so it never
 * stretches toward screen-center; meant to sit on the same row as the
 * brand wordmark on the header's other side.
 */
export function NexusLiveClock({ visible }: { readonly visible: boolean }) {
  const { now } = useNexusLiveMoment();
  return (
    <div
      className="flex max-w-[54vw] items-baseline justify-end gap-1.5 transition-opacity duration-300 sm:max-w-[240px]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="shrink-0 text-[12px] font-semibold text-white sm:text-[13px]">{formatTime(now)}</span>
      <span className="truncate text-[10px] text-white/50">{formatDateLine(now)}</span>
    </div>
  );
}

/**
 * The rotating-by-time-of-day affirmation - confined to a narrow column,
 * meant to sit on the same row as "Zebulon Commander" beneath the clock.
 * Truncates to one line; when it doesn't fit, a "more" tap opens the full
 * line plus a concrete tip for acting on it, rather than silently clipping
 * it with no way to read the rest.
 */
export function NexusLiveQuote({ visible }: { readonly visible: boolean }) {
  const { part } = useNexusLiveMoment();
  const reducedMotion = useReducedMotion();
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const entry = PART_OF_DAY_QUOTE[part];

  useLayoutEffect(() => {
    function checkTruncation() {
      const el = textRef.current;
      if (el) setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    }
    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [part]);

  return (
    <>
      <div
        className="flex max-w-[54vw] items-baseline justify-end gap-1 transition-opacity duration-300 sm:max-w-[240px]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="h-[14px] min-w-0 flex-1 overflow-hidden text-right">
          <AnimatePresence mode="wait">
            <motion.span
              key={part}
              ref={textRef}
              initial={reducedMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
              transition={{ duration: 0.4 }}
              className="block truncate text-[10px] text-white/45"
            >
              {entry.quote}
            </motion.span>
          </AnimatePresence>
        </div>
        {isTruncated && (
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="shrink-0 text-[10px] font-semibold text-cyan-300/80 underline-offset-2 hover:text-cyan-200 hover:underline"
          >
            more
          </button>
        )}
      </div>

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0a1f] p-5 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.7)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-medium leading-snug text-white">{entry.quote}</p>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">
                Try this
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{entry.tip}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
