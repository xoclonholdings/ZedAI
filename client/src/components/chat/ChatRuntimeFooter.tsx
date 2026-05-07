import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface RuntimeStatus {
  provider: string;
  model: string;
  target?: string;
  target_url?: string;
  location_label: string;
  is_local: boolean;
  status: "online" | "offline";
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  claude: "Claude",
  "claw-temp": "Remote runner",
};

function prettyModel(model: string): string {
  if (!model) return "unknown";
  // Strip an Ollama tag suffix to keep the footer compact ("qwen2.5:7b" -> "qwen2.5").
  const base = model.split(":")[0];
  if (!base) return model;
  return base
    .split(/[-_/]/)
    .map((part) => (part.length <= 3 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export default function ChatRuntimeFooter() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/system/runtime", { credentials: "include" });
        if (!res.ok) throw new Error("status fetch failed");
        const data = (await res.json()) as RuntimeStatus;
        if (!cancelled) {
          setStatus(data);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    };
    void fetchStatus();
    const interval = window.setInterval(fetchStatus, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (errored && !status) {
    return (
      <div className="flex items-center justify-center space-x-2 pt-1 text-xs text-muted-foreground">
        <Zap size={12} className="text-red-400/80" />
        <span>Runtime unavailable</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center space-x-2 pt-1 text-xs text-muted-foreground">
        <Zap size={12} className="text-muted-foreground/60" />
        <span>Checking runtime…</span>
      </div>
    );
  }

  const providerLabel = PROVIDER_LABELS[status.provider] || status.provider;
  const dotColor =
    status.status === "online"
      ? status.is_local
        ? "bg-purple-400"
        : "bg-cyan-400"
      : "bg-red-400";
  const targetTitle = status.target_url
    ? `${providerLabel} • ${status.target_url}`
    : providerLabel;

  return (
    <div
      className="flex items-center justify-center space-x-2 pt-1 text-xs text-muted-foreground"
      title={targetTitle}
    >
      <Zap size={12} className={status.is_local ? "text-purple-400" : "text-cyan-400"} />
      <span>
        {prettyModel(status.model)} via {providerLabel}
      </span>
      <span className={`h-1 w-1 rounded-full ${dotColor}`} />
      <span>{status.status === "online" ? status.location_label : "Offline"}</span>
    </div>
  );
}
