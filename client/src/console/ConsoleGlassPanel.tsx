import type { ReactNode } from "react";

/** Shared by every workspace and the live browser's full-page view. */
export const CONSOLE_CONTENT_REGION_CLASS = "absolute inset-x-0 bottom-[132px] top-[86px] px-4 sm:px-6";

/**
 * The console's shared "glass" content surface - translucent and blurred
 * rather than an opaque page, so whatever sits behind (the ambient galaxy
 * on the home screen, the accent-tinted backdrop elsewhere) stays visible
 * through it, like the console's instruments are painted on a window. Text
 * and controls render on top of the glass at full legibility; only the
 * panel itself is see-through.
 */
export function ConsoleGlassPanel({ children }: { readonly children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.055] shadow-[0_20px_70px_-25px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
