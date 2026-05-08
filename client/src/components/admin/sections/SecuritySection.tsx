import { useEffect, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AdminSecuritySettings from "@/components/settings/AdminSecuritySettings";
import EnvValidatorCard from "@/components/admin/EnvValidatorCard";

export default function SecuritySection() {
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

  return (
    <>
      <AdminSecuritySettings />
      <EnvValidatorCard />

      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-lg font-semibold">Security Event Log</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auth events, tier blocks, approvals, and audit trail.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSecurityLog}
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
                  evt.type?.includes("reject");
                const isOk =
                  evt.type?.includes("success") || evt.type?.includes("approved");
                return (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-start gap-2"
                  >
                    <span className="text-muted-foreground shrink-0 w-[70px]">
                      {evt.timestamp
                        ? new Date(evt.timestamp).toLocaleTimeString()
                        : ""}
                    </span>
                    <span
                      className={`font-medium shrink-0 w-[160px] truncate ${
                        isWarn ? "text-red-400" : isOk ? "text-green-400" : "text-purple-400"
                      }`}
                    >
                      {evt.type || "unknown"}
                    </span>
                    <span className="text-foreground/70 truncate">{evt.detail || ""}</span>
                    {evt.userId && (
                      <span className="text-muted-foreground/50 shrink-0 ml-auto">
                        {evt.userId}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
