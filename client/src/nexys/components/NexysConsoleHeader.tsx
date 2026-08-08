import { ConsoleLogoutButton } from "@/console/ConsoleLogoutButton";
import { NexysLiveClock, NexysLiveDate, NexysLiveQuote } from "./NexysLiveGreeting";

export interface NexysHeaderContext {
  readonly label: string;
  readonly color: string;
}

/**
 * Shared ZCOS/Zebulon identity used above both the application-Galaxy map
 * and an entered application's internal planet/hub system.
 */
export function NexysConsoleHeaderBrand({
  onWordmarkClick,
  wordmarkAriaLabel,
  context,
}: {
  readonly onWordmarkClick: () => void;
  readonly wordmarkAriaLabel: string;
  readonly context: NexysHeaderContext | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex h-9 items-center gap-2 leading-none">
        <button
          type="button"
          onClick={onWordmarkClick}
          aria-label={wordmarkAriaLabel}
          className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent focus:outline-none sm:text-3xl"
        >
          ZCOS
        </button>
        <ConsoleLogoutButton />
      </div>
      <div className="flex h-4 items-center truncate text-[9px] font-medium uppercase tracking-[0.12em] text-white/40">
        Zebulon Commander
      </div>
      <div className="flex h-6 items-center">
        {context ? (
          <div
            key={context.label}
            className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 backdrop-blur"
            style={{ animation: "nexys-settle 300ms ease both" }}
          >
            <span
              className="block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: context.color, boxShadow: `0 0 8px 2px ${context.color}88` }}
              aria-hidden="true"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
              {context.label}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The existing live time/date/quote stack, shared without visual changes. */
export function NexysConsoleHeaderTelemetry({ visible }: { readonly visible: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex h-9 items-center">
        <NexysLiveClock visible={visible} />
      </div>
      <div className="flex h-4 items-center">
        <NexysLiveDate visible={visible} />
      </div>
      <div className="flex h-6 items-center">
        <NexysLiveQuote visible={visible} />
      </div>
    </div>
  );
}
