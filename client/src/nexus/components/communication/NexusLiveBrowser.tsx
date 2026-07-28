import { useState } from "react";
import { Globe, Lock } from "lucide-react";

/**
 * The console's live-browser slot. This is intentionally a coded placeholder,
 * not a working feature yet: there's no backend endpoint for it to call, so
 * the address field is disabled and nothing here fetches or renders a real
 * page. It exists so the Browse toggle has real content to open into once a
 * live-browsing endpoint is wired up.
 */
export function NexusLiveBrowser() {
  const [url, setUrl] = useState("");

  return (
    <div className="flex min-h-[101px] flex-col justify-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5">
        <Lock size={12} className="shrink-0 text-white/30" aria-hidden="true" />
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Live browsing isn't connected yet"
          disabled
          aria-label="Browser address (not yet functional)"
          className="w-full bg-transparent text-[12.5px] text-white/40 placeholder:text-white/30 focus:outline-none"
        />
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/35">
        <Globe size={11} className="shrink-0" aria-hidden="true" />
        The live browser is built but has no backend endpoint yet.
      </p>
    </div>
  );
}
