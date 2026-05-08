import { useEffect, useState } from "react";
import { Bot, RefreshCw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LabeledField, ToggleField, humanizeFieldName } from "@/components/admin/fields";
import { integrationMeta, StatusDot, type IntegrationKey } from "@/components/admin/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function IntegrationsSection() {
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<IntegrationKey>("aiHost");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [aiHostStatus, setAiHostStatus] = useState<any>(null);
  const [aiHostTest, setAiHostTest] = useState<{
    status: "idle" | "testing" | "ok" | "error";
    detail?: string;
  }>({ status: "idle" });

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAdminSettings(data);
        setDraft(data.integrations);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchAiHostStatus() {
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setAiHostStatus(await res.json());
    } catch {}
  }

  useEffect(() => {
    void fetchSettings();
    void fetchAiHostStatus();
  }, []);

  function updateField(key: string, value: any) {
    setDraft((prev: any) => ({
      ...prev,
      [active]: { ...prev?.[active], [key]: value },
    }));
    setSaveStatus("idle");
  }

  async function save() {
    if (!draft) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [active]: draft[active] }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = await res.json();
      setDraft((prev: any) => ({ ...prev, [active]: updated[active] }));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      await fetchSettings();
    } catch {
      setSaveStatus("error");
    }
  }

  async function testAiHost() {
    setAiHostTest({ status: "testing" });
    try {
      const res = await fetch("/api/admin/ai-host/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI host test failed");
      if (data.chat?.status === "ok") {
        setAiHostTest({
          status: "ok",
          detail: data.chat.reply || "AI host answered successfully.",
        });
      } else {
        setAiHostTest({
          status: "error",
          detail: data.chat?.error || "AI host test failed.",
        });
      }
      await fetchAiHostStatus();
    } catch (error: any) {
      setAiHostTest({ status: "error", detail: error.message || "AI host test failed" });
    }
  }

  const selectedDraft = draft?.[active];

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Pick a feature or agent lane first, then work inside that specific section only.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(integrationMeta) as IntegrationKey[]).map((key) => {
          const meta = integrationMeta[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                active === key
                  ? "border-cyan-400/40 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                size={14}
                className={active === key ? "text-cyan-300" : "text-muted-foreground"}
              />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : active === "aiHost" ? (
        <AiHostPanel
          status={aiHostStatus}
          test={aiHostTest}
          onTest={testAiHost}
        />
      ) : !selectedDraft ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-10 text-sm text-muted-foreground">
            This integration section is not available yet.
          </CardContent>
        </Card>
      ) : (
        <IntegrationFormCard
          activeKey={active}
          draft={selectedDraft}
          onChange={updateField}
          onSave={save}
          saveStatus={saveStatus}
        />
      )}
    </>
  );
}

function AiHostPanel({
  status,
  test,
  onTest,
}: {
  status: any;
  test: { status: "idle" | "testing" | "ok" | "error"; detail?: string };
  onTest: () => void;
}) {
  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot size={16} className="text-purple-300" />
          AI Host
        </CardTitle>
        <CardDescription>
          Verifies the model provider configured by env vars
          (<code>MODEL_PROVIDER</code>, <code>OPENAI_BASE_URL</code>, <code>OPENAI_API_KEY</code>)
          by sending a one-token round-trip request. The Provider Routing card on the Overview
          tab shows what&apos;s actually wired.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2 flex items-center gap-2">
              <StatusDot online={status?.ollama?.status === "online"} />
              <span className="text-sm font-medium capitalize">
                {status?.ollama?.status || "unknown"}
              </span>
              <Badge
                variant="secondary"
                className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
              >
                {status?.ollama?.provider || "unknown"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Reported models:{" "}
              {status?.ollama?.models?.length
                ? status.ollama.models.join(", ")
                : "none reported by provider"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground/80">Common failures:</p>
            <p>
              <strong>HTTP 401</strong> — wrong / missing API key
            </p>
            <p>
              <strong>HTTP 402</strong> — provider quota / billing issue
            </p>
            <p>
              <strong>HTTP 404 or 405</strong> — base URL is wrong (must end one segment before{" "}
              <code>/chat/completions</code>)
            </p>
            <p>
              <strong>Invalid URL</strong> — env var contains stray characters like{" "}
              <code>&lt;</code> or quotes
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="zed-glass border-white/10"
            onClick={onTest}
            disabled={test.status === "testing"}
          >
            <RefreshCw
              size={14}
              className={`mr-1 ${test.status === "testing" ? "animate-spin" : ""}`}
            />
            {test.status === "testing" ? "Testing..." : "Test AI Host"}
          </Button>
          {test.status === "ok" && (
            <p className="text-xs text-emerald-300">
              Provider answered: <span className="font-mono">{test.detail}</span>
            </p>
          )}
          {test.status === "error" && (
            <pre className="w-full whitespace-pre-wrap break-all rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-[11px] text-red-300">
              {test.detail}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationFormCard({
  activeKey,
  draft,
  onChange,
  onSave,
  saveStatus,
}: {
  activeKey: IntegrationKey;
  draft: any;
  onChange: (key: string, value: any) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const meta = integrationMeta[activeKey];
  const Icon = meta.icon;
  const otherFields = Object.entries(draft).filter(
    ([key]) => !["enabled", "status", "notes"].includes(key),
  );

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={16} className="text-cyan-300" />
          {meta.label}
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleField
          label="Enabled"
          checked={!!draft.enabled}
          onChange={(next) => onChange("enabled", next)}
        />

        {"status" in draft && (
          <LabeledField
            label="Status"
            value={draft.status || ""}
            onChange={(next) => onChange("status", next)}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {otherFields.map(([key, value]) => {
            if (typeof value === "boolean") {
              return (
                <ToggleField
                  key={key}
                  label={humanizeFieldName(key)}
                  checked={value}
                  onChange={(next) => onChange(key, next)}
                />
              );
            }
            const isPort = key.toLowerCase().includes("port");
            const isSecret =
              key.toLowerCase().includes("token") ||
              key.toLowerCase().includes("password") ||
              key.toLowerCase().includes("apikey");
            return (
              <LabeledField
                key={key}
                label={humanizeFieldName(key)}
                value={String(value ?? "")}
                onChange={(next) => onChange(key, isPort ? Number(next) || 0 : next)}
                placeholder={isSecret ? "Stored server-side or paste a new value" : undefined}
              />
            );
          })}
        </div>

        {"notes" in draft && (
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Notes
            </span>
            <Textarea
              rows={5}
              value={draft.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              className="zed-glass border-white/10 text-sm"
            />
          </label>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={onSave}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Save size={14} className="mr-1" />
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved!"
                : saveStatus === "error"
                  ? "Save failed"
                  : "Save Changes"}
          </Button>
          {saveStatus === "error" && (
            <span className="text-xs text-red-400">Could not save this section.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
