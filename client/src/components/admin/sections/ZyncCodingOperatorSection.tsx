import { useEffect, useMemo, useState } from "react";
import { GitBranch, Play, RefreshCw, Search } from "lucide-react";

import { LabeledSelect, PlainTextarea, SettingGroup, SettingRow } from "./settings/atoms";

type SaveStatus = "idle" | "loading" | "error";

interface ZyncCapability {
  id: string;
  name: string;
  description: string;
  riskTier: string;
  route: string;
  wired: boolean;
}

interface ZyncStatus {
  registry: {
    version: string;
    brand: string;
    futureExtractionTarget: string;
    capabilities: ZyncCapability[];
  };
  github: {
    executed: boolean;
    providerStatus: string;
    remoteHeads: Array<{ name: string; sha: string }>;
    policy: { compliant: boolean; extras: string[] };
    error?: string;
  };
  verificationJobs: Array<{ id: string; label: string; command: string; cwd: string }>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 leading-snug focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
    />
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-45 disabled:hover:bg-white/[0.04] transition-colors"
    >
      {children}
    </button>
  );
}

function ResultPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="mt-6 border-t border-white/[0.06] pt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
        {title}
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-[12px] leading-relaxed text-white/70">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export default function ZyncCodingOperatorSection() {
  const [status, setStatus] = useState<ZyncStatus | null>(null);
  const [loadState, setLoadState] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState("Output");
  const [result, setResult] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [paths, setPaths] = useState("");
  const [impactQuery, setImpactQuery] = useState("");
  const [job, setJob] = useState("client-build");
  const [confirmBackup, setConfirmBackup] = useState("");

  async function loadStatus() {
    setLoadState("loading");
    setError(null);
    try {
      const res = await fetch("/api/admin/zync-coding-operator/status", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Status failed (${res.status})`);
      setStatus(data);
      if (data?.verificationJobs?.[0]?.id && !data.verificationJobs.some((item: any) => item.id === job)) {
        setJob(data.verificationJobs[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load Zync status");
    } finally {
      setLoadState("idle");
    }
  }

  async function postAction(title: string, url: string, body: Record<string, unknown> = {}) {
    setLoadState("loading");
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `${title} failed (${res.status})`);
      setResultTitle(title);
      setResult(data);
      void loadStatus();
    } catch (err: any) {
      setError(err?.message || `${title} failed`);
    } finally {
      setLoadState("idle");
    }
  }

  async function getAction(title: string, url: string) {
    setLoadState("loading");
    setError(null);
    try {
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `${title} failed (${res.status})`);
      setResultTitle(title);
      setResult(data);
      void loadStatus();
    } catch (err: any) {
      setError(err?.message || `${title} failed`);
    } finally {
      setLoadState("idle");
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const jobOptions = useMemo(
    () =>
      (status?.verificationJobs || []).map((item) => ({
        value: item.id,
        label: item.label,
      })),
    [status?.verificationJobs],
  );

  const capabilities = status?.registry?.capabilities || [];
  const allWired = capabilities.length > 0 && capabilities.every((capability) => capability.wired);
  const backupCanRun = confirmBackup === "refresh backup to current main";

  return (
    <div className="min-w-0">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Zync coding operator
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Repo-aware coding operations that Zed can actually run today, kept in a Zync-branded core-memory module for later extraction.
          </p>
        </div>
        <ActionButton onClick={() => void loadStatus()} disabled={loadState === "loading"}>
          <RefreshCw size={12} className={loadState === "loading" ? "animate-spin" : ""} />
          Refresh
        </ActionButton>
      </header>

      {error && (
        <div className="mb-5 rounded-lg border border-red-400/30 bg-red-500/[0.06] px-3.5 py-3 text-[13px] text-red-200">
          {error}
        </div>
      )}

      <div className="mb-5 text-[12.5px] text-white/40">
        Registry {status?.registry?.version || "not loaded"} · {allWired ? "all handlers wired" : "handler check pending"}
        {status?.github?.policy && ` · GitHub branches ${status.github.policy.compliant ? "clean" : "need attention"}`}
      </div>

      <SettingGroup title="Capabilities" count={capabilities.length}>
        {capabilities.map((capability) => (
          <SettingRow
            key={capability.id}
            label={capability.name}
            description={`${capability.description} Route: ${capability.route}`}
          >
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em] ${
                capability.wired
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-red-400/15 text-red-300"
              }`}
            >
              {capability.wired ? "wired" : "missing"}
            </span>
          </SettingRow>
        ))}
      </SettingGroup>

      <SettingGroup title="Run operations">
        <SettingRow
          label="Repository context scan"
          description="Reads git state, package scripts, important directories, registry status, and verification jobs."
        >
          <ActionButton
            onClick={() => void postAction("Repository context scan", "/api/admin/zync-coding-operator/repo-scan")}
            disabled={loadState === "loading"}
          >
            <Search size={12} />
            Scan
          </ActionButton>
        </SettingRow>

        <SettingRow
          label="Code search"
          description="Searches source files by filename and content with bounded results."
          stack
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput value={query} onChange={setQuery} placeholder="Search code..." ariaLabel="Search code" />
            <ActionButton
              onClick={() =>
                void postAction("Code search", "/api/admin/zync-coding-operator/code-search", {
                  query,
                  limit: 40,
                })
              }
              disabled={loadState === "loading" || !query.trim()}
            >
              <Search size={12} />
              Search
            </ActionButton>
          </div>
        </SettingRow>

        <SettingRow
          label="Impact review"
          description="Enter paths, one per line, or a search query. Zync finds references, estimates risk, and suggests verification jobs."
          stack
        >
          <div className="grid gap-2">
            <PlainTextarea
              value={paths}
              onChange={setPaths}
              ariaLabel="Paths to review"
              placeholder="server/routes.ts&#10;client/src/pages/admin.tsx"
              rows={3}
            />
            <TextInput
              value={impactQuery}
              onChange={setImpactQuery}
              placeholder="Optional query if paths are empty"
              ariaLabel="Impact review query"
            />
            <div>
              <ActionButton
                onClick={() =>
                  void postAction("Impact review", "/api/admin/zync-coding-operator/impact-review", {
                    paths: paths
                      .split(/\r?\n/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                    query: impactQuery,
                  })
                }
                disabled={loadState === "loading" || (!paths.trim() && !impactQuery.trim())}
              >
                <Search size={12} />
                Review
              </ActionButton>
            </div>
          </div>
        </SettingRow>

        <SettingRow label="Verification runner" description="Runs an allowlisted local verification command and returns the actual exit code.">
          <div className="flex items-center gap-2">
            {jobOptions.length > 0 && (
              <LabeledSelect value={job} onChange={setJob} options={jobOptions} minWidth={190} />
            )}
            <ActionButton
              onClick={() =>
                void postAction("Verification run", "/api/admin/zync-coding-operator/verify", { job })
              }
              disabled={loadState === "loading" || !job}
            >
              <Play size={12} />
              Run
            </ActionButton>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="GitHub branch hygiene">
        <SettingRow
          label="Remote branch check"
          description="Reads GitHub branch heads through the GitHub CLI and verifies only main and backup exist."
        >
          <ActionButton
            onClick={() => void getAction("GitHub branch check", "/api/admin/zync-coding-operator/github-branches")}
            disabled={loadState === "loading"}
          >
            <GitBranch size={12} />
            Check
          </ActionButton>
        </SettingRow>

        <SettingRow
          label="Refresh backup"
          description={'Type "refresh backup to current main" to force backup to the current GitHub main SHA.'}
          stack
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              value={confirmBackup}
              onChange={setConfirmBackup}
              placeholder="refresh backup to current main"
              ariaLabel="Confirm backup refresh"
            />
            <ActionButton
              onClick={() =>
                void postAction("Refresh backup", "/api/admin/zync-coding-operator/github-backup/refresh", {
                  confirm: confirmBackup,
                })
              }
              disabled={loadState === "loading" || !backupCanRun}
            >
              <GitBranch size={12} />
              Refresh
            </ActionButton>
          </div>
        </SettingRow>
      </SettingGroup>

      {result !== null && <ResultPanel title={resultTitle} value={result} />}
    </div>
  );
}
