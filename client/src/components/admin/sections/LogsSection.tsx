import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LogsSection() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.entries || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void fetchLogs();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Routing Logs</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLogs}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : logs.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No routing logs yet. Send a message in Agent mode to generate entries.
          </CardContent>
        </Card>
      ) : (
        <Card className="zed-glass border-white/10">
          <CardContent className="pt-4">
            <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono">
              {[...logs].reverse().map((entry, i) => {
                let parsed: any = {};
                try {
                  parsed = JSON.parse(entry);
                } catch {}
                return (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5"
                  >
                    <span className="text-muted-foreground">
                      {parsed.timestamp
                        ? new Date(parsed.timestamp).toLocaleTimeString()
                        : ""}
                    </span>
                    <span className="mx-2 text-purple-400 font-medium">
                      {parsed.agent || "—"}
                    </span>
                    <span className="text-foreground/70">
                      {parsed.conversationId
                        ? `conv:${String(parsed.conversationId).slice(0, 8)}`
                        : ""}
                    </span>
                    {parsed.messageLength && (
                      <span className="ml-2 text-muted-foreground">
                        {parsed.messageLength} chars
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
