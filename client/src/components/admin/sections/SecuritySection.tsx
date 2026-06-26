import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Lock, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AdminSecuritySettings from "@/components/settings/AdminSecuritySettings";
import EnvValidatorCard from "@/components/admin/EnvValidatorCard";

type SecurityView = "access" | "environment" | "audit";

export default function SecuritySection() {
  const [view, setView] = useState<SecurityView>("access");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchSecurityLog() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security-log", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEvents((data.events || []).reverse());
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void fetchSecurityLog();
  }, []);

  const counts = useMemo(
    () => ({
      events: events.length,
      warnings: events.filter((evt) =>
        String(evt.type || "").match(/fail|block|reject|error|lock/i),
      ).length,
    }),
    [events],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Security</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage admin access, validate deployment configuration, and review security events from one focused control center.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSecurityLog}
          disabled={loading}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh Log
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SecurityViewCard
          label="Access Control"
          description="Admin phrase, sessions, lockouts, cookies."
          active={view === "access"}
          icon={KeyRound}
          onClick={() => setView("access")}
        />
        <SecurityViewCard
          label="Environment"
          description="Required variables, URLs, secrets, deploy health."
          active={view === "environment"}
          icon={ShieldCheck}
          onClick={() => setView("environment")}
        />
        <SecurityViewCard
          label="Audit Log"
          description={`${counts.events} events, ${counts.warnings} warnings.`}
          active={view === "audit"}
          icon={SlidersHorizontal}
          onClick={() => setView("audit")}
        />
      </div>

      {view === "access" && <AdminSecuritySettings />}
      {view === "environment" && <EnvValidatorCard />}
      {view === "audit" && (
        <SecurityAuditLog events={events} loading={loading} onRefresh={fetchSecurityLog} />
      )}
    </div>
  );
}

function SecurityViewCard({
  label,
  description,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  icon: any;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
          : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-white/10 bg-black/40 p-2">
          <Icon size={15} className={active ? "text-cyan-300" : "text-foreground/70"} />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}

function SecurityAuditLog({
  events,
  loading,
  onRefresh,
}: {
  events: any[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h3 className="text-base font-semibold">Security Event Log</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auth events, tier blocks, approvals, and audit trail.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : events.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Lock size={32} className="mx-auto mb-3 text-purple-400/50" />
            No security events recorded yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="zed-glass border-white/10">
          <CardContent className="pt-4">
            <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono">
              {events.map((evt, i) => {
                const isWarn =
                  evt.type?.includes("fail") ||
                  evt.type?.includes("block") ||
                  evt.type?.includes("reject") ||
                  evt.type?.includes("error");
                const isOk = evt.type?.includes("success") || evt.type?.includes("approved");
                return (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-start gap-2"
                  >
                    <span className="text-muted-foreground shrink-0 w-[70px]">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ""}
                    </span>
                    <span
                      className={`font-medium shrink-0 w-[160px] truncate ${
                        isWarn ? "text-red-400" : isOk ? "text-green-400" : "text-purple-400"
                      }`}
                    >
                      {evt.type || "unknown"}
                    </span>
                    <span className="text-foreground/70 truncate">{evt.detail || ""}</span>
                    {isWarn && <AlertTriangle size={12} className="ml-auto shrink-0 text-red-300" />}
                    {evt.userId && (
                      <span className="text-muted-foreground/50 shrink-0 ml-auto">{evt.userId}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
