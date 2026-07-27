import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * The Console Activator - the small symbol shared by every galaxy's console.
 * Selecting it powers the attached ConsoleDock on or off; it never navigates
 * anywhere itself.
 */
export function ConsoleActivator({
  active,
  onToggle,
  accent,
}: {
  readonly active: boolean;
  readonly onToggle: () => void;
  readonly accent: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-label={active ? "Power console down" : "Power console up"}
      aria-pressed={active}
      className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border text-violet-200 backdrop-blur focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
      animate={{
        borderColor: active ? `${accent}99` : "rgba(255,255,255,0.15)",
        backgroundColor: active ? `${accent}26` : "rgba(255,255,255,0.03)",
        boxShadow: active ? `0 0 26px 6px ${accent}55` : "0 0 18px rgba(167,139,250,0.25)",
        color: active ? "#ffffff" : "#ddd6fe",
      }}
      whileTap={reducedMotion ? undefined : { scale: 0.88 }}
      transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
    >
      <motion.span
        animate={
          reducedMotion
            ? undefined
            : active
              ? { rotate: [0, 18, -12, 0], scale: [1, 1.18, 1] }
              : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Sparkles size={18} />
      </motion.span>
    </motion.button>
  );
}
