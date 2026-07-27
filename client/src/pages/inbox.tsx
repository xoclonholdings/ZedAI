import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Inbox as InboxIcon, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface InboxMessage {
  id: string;
  account_id: string;
  sender: string;
  subject: string;
  body: string;
  received_at: string;
  flags?: {
    starred?: boolean;
    important?: boolean;
    has_attachment?: boolean;
    thread_length?: number;
  };
}

interface InboxFinding {
  message: InboxMessage;
  classification: {
    priority: string;
    category: string;
    recommended_action: string;
  };
  needs_attention: boolean;
  follow_up_hint: string;
}

interface InboxResponse {
  status: {
    address: string;
    connected: boolean;
    provider: string;
    detail: string;
  };
  messages: InboxMessage[];
  findings: InboxFinding[];
}

export default function InboxPage() {
  const [, navigate] = useLocation();
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/inbox/email?limit=50", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInbox(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const attentionIds = new Set((inbox?.findings || []).map((finding) => finding.message.id));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/nexus")}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Nexus
        </Button>
        <div className="flex items-center gap-2">
          <InboxIcon size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            Inbox
          </span>
        </div>
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

      <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
            {inbox?.status.address || "zed@zed-ai.online"}
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Email Inbox</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {inbox?.status.detail || "Checking the ZED mailbox connection."}
          </p>
          {inbox?.status && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary" className="border border-white/10 bg-black/30 text-cyan-100">
                {inbox.status.provider}
              </Badge>
              <Badge
                variant="secondary"
                className={`border ${
                  inbox.status.connected
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                }`}
              >
                {inbox.status.connected ? "connected" : "needs connection"}
              </Badge>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !inbox ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading inbox...</div>
        ) : !inbox || inbox.messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-muted-foreground">
            No email messages are available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {inbox.messages.map((message) => {
              const finding = inbox.findings.find((item) => item.message.id === message.id);
              return (
                <article
                  key={message.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{message.subject}</div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        {message.sender}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {attentionIds.has(message.id) && (
                        <Badge variant="secondary" className="border border-amber-400/30 bg-amber-500/10 text-[9px] uppercase tracking-[0.16em] text-amber-200">
                          Attention
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(message.received_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {message.body || "No message body."}
                  </p>
                  {finding && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                      <span className="text-cyan-200">{finding.classification.category}</span>
                      {" - "}
                      {finding.follow_up_hint}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
