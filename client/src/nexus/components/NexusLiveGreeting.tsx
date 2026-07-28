import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type PartOfDay = "morning" | "afternoon" | "evening";

/** Exactly one line per part of day - not a rotating pool, per the "only 3 quotes a day" spec. */
const PART_OF_DAY_QUOTE: Record<PartOfDay, string> = {
  morning: "Small steps compound into orbit.",
  afternoon: "Clarity first, velocity second.",
  evening: "The mission continues whether you feel ready or not.",
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
  const monthDay = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return `${weekday}, ${monthDay}`;
}

/**
 * Replaces the old static "Good evening / How can I assist you today?"
 * lines - the console's live vitals: current time, date, day of week, and
 * one of exactly three affirmations (morning/afternoon/evening), so the
 * header reads as a living instrument rather than a fixed greeting. Compact
 * and right-aligned so it stays visually secondary to the brand/domain name
 * on the header's other side.
 */
export function NexusLiveGreeting({ visible }: { readonly visible: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const part = partOfDay(now);

  return (
    <div className="text-right transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
      <div className="flex items-baseline justify-end gap-1.5">
        <span className="text-[12px] font-semibold text-white sm:text-[13px]">{formatTime(now)}</span>
        <span className="truncate text-[10px] text-white/50">{formatDateLine(now)}</span>
      </div>
      <div className="mt-0.5 h-[14px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={part}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
            transition={{ duration: 0.4 }}
            className="max-w-[46vw] truncate text-[10px] text-white/45 sm:max-w-[220px]"
          >
            {PART_OF_DAY_QUOTE[part]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
