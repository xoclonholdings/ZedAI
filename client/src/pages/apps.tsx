import { Boxes } from "lucide-react";

/**
 * The ZCOS Extension access layer. The current repository has no canonical
 * Extension registry yet, so this surface reports that state instead of
 * fabricating installed apps or treating external Integrations as Apps.
 */
export default function AppsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-black p-5 backdrop-blur-md shadow-[0_0_40px_rgba(45,212,191,0.12)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200/80">
          <Boxes size={14} />
          Apps
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Extensions</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Extensions installed for your ZCOS Identity will appear here in every galaxy.
        </p>
      </section>

      <section className="zar-glass rounded-2xl p-4 text-sm leading-6 text-muted-foreground">
        The Extension registry is not connected to this surface yet. External services remain under Settings and Integrations.
      </section>
    </main>
  );
}
