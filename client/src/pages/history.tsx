import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Conversation } from "@shared/schema";
import type { FlowRun } from "../../../shared/flow-types";
import { RUN_STATUS_STYLE } from "./runs/styles";

function statusLabel(status: FlowRun["status"]): string {
  if (status === "awaiting_approval") return "Waiting for Approval";
  return status.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [flowRuns, setFlowRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [conversationsRes, runsRes] = await Promise.all([
        fetch("/api/conversations", { credentials: "include" }),
        fetch("/api/flows/runs", { credentials: "include" }),
      ]);

      if (!conversationsRes.ok) throw new Error(`Conversations HTTP ${conversationsRes.status}`);
      if (!runsRes.ok) throw new Error(`Template flows HTTP ${runsRes.status}`);

      const conversationsData = await conversationsRes.json();
      const runsData = await runsRes.json();

      setConversations(Array.isArray(conversationsData) ? conversationsData : []);
      setFlowRuns(Array.isArray(runsData.runs) ? runsData.runs : []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const isEmpty = conversations.length === 0 && flowRuns.length === 0;

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-foreground zed-button"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <main className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Saved Activity</div>
          <h1 className="mt-2 text-2xl font-semibold">History</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review chat conversations separately from template flow runs and completed work.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && isEmpty ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            No history yet. Chat conversations and template flow runs will appear here.
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Chat Conversations
                </h2>
                <span className="text-xs text-muted-foreground">{conversations.length}</span>
              </div>

              {conversations.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
                  No chat conversations yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => navigate(`/chat/${conversation.id}`)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="truncate text-sm font-medium">
                        {conversation.title || "New Conversation"}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        {conversation.preview || "Open chat thread"}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {formatDate(conversation.updatedAt || conversation.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
                  Template Flows History
                </h2>
                <span className="text-xs text-muted-foreground">{flowRuns.length}</span>
              </div>

              {flowRuns.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
                  No template flow runs yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {flowRuns.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/history/${item.id}`)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{item.flowName}</span>
                        <Badge
                          variant="secondary"
                          className={`border text-[9px] uppercase tracking-[0.16em] ${RUN_STATUS_STYLE[item.status]}`}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatDate(item.startedAt)} - {item.progressPct}% complete
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
