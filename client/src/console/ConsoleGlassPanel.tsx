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
 *
 * `flush` is for content that manages its own full-height layout and
 * internal scrolling (a message list + pinned composer, e.g. chat) rather
 * than being a normal page that scrolls as a whole - it drops the padded,
 * page-scrolls wrapper for an edge-to-edge flex column the child can fill.
 */
export function ConsoleGlassPanel({
  children,
  flush,
}: {
  readonly children: ReactNode;
  readonly flush?: boolean;
}) {
  if (flush) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] shadow-[0_20px_70px_-25px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">{children}</div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.055] shadow-[0_20px_70px_-25px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
