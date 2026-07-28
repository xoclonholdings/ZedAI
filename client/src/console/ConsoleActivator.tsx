import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * The Console Activator - the small symbol shared by every galaxy's console,
 * sitting directly above the dock it powers. Standby breathes with a slow
 * pulsing glow (an idle instrument waiting to be woken); once the dock is
 * powered on, the glow holds steady instead of pulsing.
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

  const steadyAnimate = {
    borderColor: `${accent}99`,
    backgroundColor: `${accent}26`,
    color: "#ffffff",
    boxShadow: `0 0 28px 8px ${accent}66`,
    scale: 1,
  };
  const pulseAnimate = reducedMotion
    ? { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.03)", color: "#ddd6fe", boxShadow: `0 0 18px 3px ${accent}44`, scale: 1 }
    : {
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.03)",
        color: "#ddd6fe",
        boxShadow: [`0 0 12px 2px ${accent}33`, `0 0 26px 8px ${accent}77`, `0 0 12px 2px ${accent}33`],
        scale: [1, 1.05, 1],
      };

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-label={active ? "Power console down" : "Power console up"}
      aria-pressed={active}
      className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border text-violet-200 backdrop-blur focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
      animate={active ? steadyAnimate : pulseAnimate}
      transition={
        active
          ? { duration: 0.35, ease: "easeOut" }
          : { duration: 2.4, repeat: reducedMotion ? 0 : Infinity, ease: "easeInOut" }
      }
      whileTap={reducedMotion ? undefined : { scale: 0.88 }}
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
