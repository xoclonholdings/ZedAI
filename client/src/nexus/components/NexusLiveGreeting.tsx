import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const AFFIRMATIONS = [
  "Small steps compound into orbit.",
  "Clarity first, velocity second.",
  "You don't need permission to begin.",
  "Momentum is built one decision at a time.",
  "Today is raw material - shape it.",
  "Discipline is choosing what you want most over what you want now.",
  "The mission continues whether you feel ready or not.",
  "Every system you build outlives the mood you built it in.",
  "Progress hides inside the boring parts.",
  "Steady hands, clear orders, one system at a time.",
];

const ROTATE_MS = 9000;
const CLOCK_TICK_MS = 15000;

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
 * lines - the console's live vitals: current time, date, day of week, and a
 * slowly rotating affirmation, so the header reads as a living instrument
 * rather than a fixed greeting.
 */
export function NexusLiveGreeting({ visible }: { readonly visible: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIndex((value) => (value + 1) % AFFIRMATIONS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-white sm:text-lg">{formatTime(now)}</span>
        <span className="truncate text-[13px] text-white/50">{formatDateLine(now)}</span>
      </div>
      <div className="mt-0.5 h-[18px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="truncate text-[13px] text-white/45"
          >
            {AFFIRMATIONS[quoteIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
