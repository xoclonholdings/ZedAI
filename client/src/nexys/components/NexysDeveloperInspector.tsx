import { GitBranch, Layers, RadioTower, type LucideIcon } from "lucide-react";

import { useNexys } from "../state/NexysProvider";

export function NexysDeveloperInspector() {
  const { snapshot, viewport } = useNexys();

  return (
    <section className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 max-h-[40vh] overflow-y-auto rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-80">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-200/20 bg-amber-200/[0.07] text-amber-100">
          <Layers size={18} />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-white">Nexys Developer Inspector</div>
          <div className="text-[11px] text-white/45">
            Visible only in development with debug=nexys
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InspectorMetric icon={GitBranch} label="Root nodes" value={snapshot.rootNodes.length} />
        <InspectorMetric icon={Layers} label="Connections" value={snapshot.connections.length} />
        <InspectorMetric icon={RadioTower} label="Transition" value={viewport.transitionSerial} />
      </div>
    </section>
  );
}

function InspectorMetric({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
      <Icon size={14} className="text-amber-100/80" />
      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.38]">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-white/78">{value}</div>
    </div>
  );
}
