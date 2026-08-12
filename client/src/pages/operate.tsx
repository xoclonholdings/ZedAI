import { CheckSquare, Lightbulb, Search } from "lucide-react";
import { useLocation } from "wouter";

const OPERATE_CONTROLS = [
  {
    label: "Ideas",
    description: "Capture short ideas in a lightweight scratchpad.",
    route: "/desk/ideas",
    icon: Lightbulb,
  },
  {
    label: "Task",
    description: "Keep a shared to-do list with ZAR suggestions, timing, and approvals.",
    route: "/desk/task",
    icon: CheckSquare,
  },
  {
    label: "Search",
    description: "Open the in-app browser.",
    route: "/desk/search",
    icon: Search,
  },
] as const;

export default function OperateDeskPage() {
  const [, navigate] = useLocation();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-black p-5 backdrop-blur-md shadow-[0_0_40px_rgba(59,130,246,0.12)]">
        <div className="text-xs uppercase tracking-[0.2em] text-blue-200/80">Operate Desk</div>
        <h1 className="mt-2 text-2xl font-semibold">What are we doing?</h1>
      </section>

      <section className="grid gap-3">
        {OPERATE_CONTROLS.map(({ label, description, route, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(route)}
            className="zar-glass flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_24px_rgba(59,130,246,0.22)] active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{label}</div>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
