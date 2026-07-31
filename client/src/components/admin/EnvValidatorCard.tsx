import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Severity = "ok" | "warn" | "error";

interface EnvCheck {
  name: string;
  severity: Severity;
  message: string;
  hint?: string;
}

interface ValidateResponse {
  ok: boolean;
  checks: EnvCheck[];
  summary: { ok: number; warn: number; error: number };
}

const SEVERITY_STYLES: Record<Severity, { icon: any; cls: string; label: string }> = {
  ok: {
    icon: CheckCircle2,
    cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
    label: "OK",
  },
  warn: {
    icon: AlertTriangle,
    cls: "border-yellow-500/30 bg-yellow-500/5 text-yellow-200",
    label: "WARN",
  },
  error: {
    icon: XCircle,
    cls: "border-red-500/30 bg-red-500/5 text-red-200",
    label: "ERROR",
  },
};

export default function EnvValidatorCard() {
  const [data, setData] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/env-validate", { credentials: "include" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
      }
      setData((await res.json()) as ValidateResponse);
    } catch (e: any) {
      setErr(e?.message || "validation failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="zar-glass border-white/10">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck size={16} className="text-emerald-300" />
              Environment Validator
            </CardTitle>
            <CardDescription>
              One-click check for the env vars this deploy actually depends on. Catches
              malformed URLs, weak <code>SESSION_SECRET</code>, missing keys, etc.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={run}
            disabled={loading}
            className="zar-glass border-white/10"
          >
            {loading ? "Checking…" : data ? "Re-run" : "Validate Environment"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {err}
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-300">{data.summary.ok} OK</span>
              <span className="text-yellow-300">{data.summary.warn} warning</span>
              <span className="text-red-300">{data.summary.error} error</span>
            </div>
            <div className="space-y-2">
              {data.checks.map((check, idx) => {
                const style = SEVERITY_STYLES[check.severity];
                const Icon = style.icon;
                return (
                  <div
                    key={`${check.name}-${idx}`}
                    className={`rounded-lg border px-3 py-2 ${style.cls}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon size={14} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-medium">{check.name}</span>
                          <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">
                            {style.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5">{check.message}</p>
                        {check.hint && (
                          <p className="mt-1 text-[11px] italic opacity-80">
                            Hint: {check.hint}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!data && !err && !loading && (
          <p className="text-xs text-muted-foreground">
            Click <em>Validate Environment</em> to run all checks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
