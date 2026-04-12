import { useEffect, useState } from "react";
import { Briefcase, Github, Mail, Mic, Phone, RefreshCw, Save, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type IntegrationState = {
  gusto: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    environment: "sandbox" | "production";
    companyId: string;
    apiBaseUrl: string;
    clientId: string;
    webhookBaseUrl: string;
    notes: string;
  };
  github: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    apiBaseUrl: string;
    owner: string;
    repo: string;
    defaultBranch: string;
    token: string;
    hasToken?: boolean;
    notes: string;
  };
  email: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    provider: "smtp" | "gmail" | "outlook" | "custom";
    fromName: string;
    fromAddress: string;
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    hasPassword?: boolean;
    notes: string;
  };
  telephony: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    provider: "twilio" | "sip" | "custom";
    phoneNumber: string;
    voicemailEmail: string;
    voiceAgentEnabled: boolean;
    accountSid: string;
    apiKey: string;
    hasApiKey?: boolean;
    notes: string;
  };
  firewall: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    publicBaseUrl: string;
    vpnBaseUrl: string;
    preferredRoute: "vpn" | "public";
    vpnProvider: string;
    authToken: string;
    hasAuthToken?: boolean;
    healthPath: string;
    publicHealthPath: string;
    zedAiWebhookBaseUrl: string;
    notes: string;
  };
  businessOperations: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    ecommerce: boolean;
    dropshipping: boolean;
    realEstate: boolean;
    acquisitions: boolean;
    businessCredit: boolean;
    rdSuggestions: boolean;
    notes: string;
  };
  kalshi: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
    environment: "demo" | "production";
    apiBaseUrl: string;
    email: string;
    notes: string;
  };
  voiceTranscription: {
    enabled: boolean;
    status: "planned" | "browser-only" | "active";
    provider: string;
  };
};

type GitHubReadout = {
  status?: {
    message?: string;
    repoFullName?: string;
    defaultBranch?: string;
  };
  pulls?: Array<{ number: number; title: string; url: string; draft: boolean }>;
  issues?: Array<{ number: number; title: string; url: string }>;
};

type FirewallStatus = {
  status?: string;
  message?: string;
  route?: "vpn" | "public";
  baseUrl?: string;
  vpnProvider?: string;
  failures?: string[];
  firewall?: {
    status?: string;
    threatCounters?: Record<string, number>;
    recentSecurityEvents?: Array<{ id?: number; severity?: string; description?: string }>;
  };
};

const defaults: IntegrationState = {
  gusto: {
    enabled: false,
    status: "planned",
    environment: "sandbox",
    companyId: "",
    apiBaseUrl: "https://api.gusto-demo.com",
    clientId: "",
    webhookBaseUrl: "",
    notes: "",
  },
  github: {
    enabled: false,
    status: "planned",
    apiBaseUrl: "https://api.github.com",
    owner: "",
    repo: "",
    defaultBranch: "main",
    token: "",
    hasToken: false,
    notes: "",
  },
  email: {
    enabled: false,
    status: "planned",
    provider: "smtp",
    fromName: "ZED Executive Office",
    fromAddress: "",
    smtpHost: "",
    smtpPort: 587,
    username: "",
    password: "",
    hasPassword: false,
    notes: "",
  },
  telephony: {
    enabled: false,
    status: "planned",
    provider: "twilio",
    phoneNumber: "",
    voicemailEmail: "",
    voiceAgentEnabled: false,
    accountSid: "",
    apiKey: "",
    hasApiKey: false,
    notes: "",
  },
  firewall: {
    enabled: false,
    status: "planned",
    publicBaseUrl: "",
    vpnBaseUrl: "",
    preferredRoute: "vpn",
    vpnProvider: "Tailscale",
    authToken: "",
    hasAuthToken: false,
    healthPath: "/api/integration/firewall/status",
    publicHealthPath: "/api/firewall/public-status",
    zedAiWebhookBaseUrl: "",
    notes: "Use the VPN URL for ZED server-to-server access and the public domain for operators.",
  },
  businessOperations: {
    enabled: true,
    status: "configured",
    ecommerce: true,
    dropshipping: true,
    realEstate: true,
    acquisitions: true,
    businessCredit: true,
    rdSuggestions: true,
    notes: "",
  },
  kalshi: {
    enabled: false,
    status: "planned",
    environment: "demo",
    apiBaseUrl: "https://demo-api.kalshi.co",
    email: "",
    notes: "Planned event-market integration for R&D and prediction market workflows.",
  },
  voiceTranscription: {
    enabled: false,
    status: "browser-only",
    provider: "Browser Speech API",
  },
};

export default function IntegrationSettings() {
  const [data, setData] = useState<IntegrationState>(defaults);
  const [saving, setSaving] = useState(false);
  const [githubStatus, setGitHubStatus] = useState("");
  const [githubTesting, setGitHubTesting] = useState(false);
  const [githubReadout, setGitHubReadout] = useState<GitHubReadout | null>(null);
  const [firewallStatus, setFirewallStatus] = useState("");
  const [firewallTesting, setFirewallTesting] = useState(false);
  const [firewallReadout, setFirewallReadout] = useState<FirewallStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/settings", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setData({
            gusto: { ...defaults.gusto, ...(payload.integrations?.gusto || {}) },
            github: { ...defaults.github, ...(payload.integrations?.github || {}) },
            email: { ...defaults.email, ...(payload.integrations?.email || {}) },
            telephony: { ...defaults.telephony, ...(payload.integrations?.telephony || {}) },
            firewall: { ...defaults.firewall, ...(payload.integrations?.firewall || {}) },
            businessOperations: {
              ...defaults.businessOperations,
              ...(payload.integrations?.businessOperations || {}),
            },
            kalshi: { ...defaults.kalshi, ...(payload.integrations?.kalshi || {}) },
            voiceTranscription: {
              ...defaults.voiceTranscription,
              ...(payload.integrations?.voiceTranscription || {}),
            },
          });
        }
      } catch {}
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const next = await response.json();
        setData({
          gusto: { ...defaults.gusto, ...(next.gusto || {}) },
          github: { ...defaults.github, ...(next.github || {}) },
          email: { ...defaults.email, ...(next.email || {}) },
          telephony: { ...defaults.telephony, ...(next.telephony || {}) },
          firewall: { ...defaults.firewall, ...(next.firewall || {}) },
          businessOperations: { ...defaults.businessOperations, ...(next.businessOperations || {}) },
          kalshi: { ...defaults.kalshi, ...(next.kalshi || {}) },
          voiceTranscription: { ...defaults.voiceTranscription, ...(next.voiceTranscription || {}) },
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function testGitHubConnection() {
    setGitHubTesting(true);
    setGitHubStatus("");
    try {
      const [statusResponse, readoutResponse] = await Promise.all([
        fetch("/api/admin/integrations/github/status", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/integrations/github/readout", { credentials: "include", cache: "no-store" }),
      ]);
      const statusPayload = await statusResponse.json();
      const readoutPayload = await readoutResponse.json();
      setGitHubStatus(statusPayload.message || "GitHub status checked.");
      setGitHubReadout(readoutPayload);
      if (statusPayload.defaultBranch) {
        setData((prev) => ({
          ...prev,
          github: {
            ...prev.github,
            defaultBranch: statusPayload.defaultBranch || prev.github.defaultBranch,
            status:
              statusPayload.authenticated && statusPayload.repoFound ? "active" : prev.github.status,
          },
        }));
      }
    } catch {
      setGitHubStatus("GitHub status check failed.");
    } finally {
      setGitHubTesting(false);
    }
  }

  async function testFirewallConnection() {
    setFirewallTesting(true);
    setFirewallStatus("");
    try {
      const response = await fetch("/api/admin/integrations/firewall/status", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json();
      setFirewallReadout(payload);
      setFirewallStatus(payload.message || "Firewall status checked.");

      if (payload.status === "connected") {
        setData((prev) => ({
          ...prev,
          firewall: {
            ...prev.firewall,
            status: "active",
            enabled: true,
          },
        }));
      }
    } catch {
      setFirewallStatus("Firewall status check failed.");
    } finally {
      setFirewallTesting(false);
    }
  }

  function toggleBusinessFlag(key: keyof IntegrationState["businessOperations"]) {
    setData((prev) => ({
      ...prev,
      businessOperations: {
        ...prev.businessOperations,
        [key]: !prev.businessOperations[key],
      },
    }));
  }

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-300" />
            Fantasma Firewall + VPN
          </CardTitle>
          <CardDescription>
            Private firewall reachability for ZED over VPN, with a separate public domain for operator access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.firewall.status}</Badge>
            <Badge className={data.firewall.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.firewall.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge className={data.firewall.hasAuthToken ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-white/70"}>
              {data.firewall.hasAuthToken ? "Token stored" : "No token"}
            </Badge>
            <Badge className="bg-white/10 text-white/70">Preferred route: {data.firewall.preferredRoute}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Public Firewall Domain</Label>
              <Input
                value={data.firewall.publicBaseUrl}
                placeholder="https://firewall.yourdomain.com"
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, publicBaseUrl: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label>VPN Firewall URL</Label>
              <Input
                value={data.firewall.vpnBaseUrl}
                placeholder="http://100.x.x.x:5000"
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, vpnBaseUrl: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label>VPN Provider</Label>
              <Input
                value={data.firewall.vpnProvider}
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, vpnProvider: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Route</Label>
              <Input
                value={data.firewall.preferredRoute}
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, preferredRoute: e.target.value === "public" ? "public" : "vpn" } }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Private Health Path</Label>
              <Input
                value={data.firewall.healthPath}
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, healthPath: e.target.value } }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Public Health Path</Label>
              <Input
                value={data.firewall.publicHealthPath}
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, publicHealthPath: e.target.value } }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Shared Auth Token</Label>
              <Input
                type="password"
                value={data.firewall.authToken}
                placeholder={data.firewall.hasAuthToken ? "Stored token preserved unless replaced" : "Paste shared firewall token"}
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, authToken: e.target.value } }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ZED Webhook Base URL</Label>
              <Input
                value={data.firewall.zedAiWebhookBaseUrl}
                placeholder="https://zed.yourdomain.com"
                onChange={(e) => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, zedAiWebhookBaseUrl: e.target.value } }))}
              />
            </div>
          </div>
          {firewallStatus && <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">{firewallStatus}</div>}
          {firewallReadout && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-sm text-muted-foreground">
              <p>Route used: {firewallReadout.route || "none"}</p>
              <p>Endpoint: {firewallReadout.baseUrl || "not connected"}</p>
              {firewallReadout.firewall?.threatCounters && (
                <p>
                  Threat counters:{" "}
                  {Object.entries(firewallReadout.firewall.threatCounters)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(" | ")}
                </p>
              )}
              {(firewallReadout.failures || []).length > 0 && <p>Failures: {firewallReadout.failures!.join(", ")}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => setData((prev) => ({ ...prev, firewall: { ...prev.firewall, enabled: !prev.firewall.enabled, status: prev.firewall.enabled ? "planned" : "configured" } }))}
            >
              {data.firewall.enabled ? "Disable Firewall" : "Enable Firewall"}
            </Button>
            <Button variant="outline" className="border-white/10" onClick={testFirewallConnection} disabled={firewallTesting}>
              <RefreshCw className={`mr-2 h-4 w-4 ${firewallTesting ? "animate-spin" : ""}`} />
              {firewallTesting ? "Checking..." : "Test Firewall"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-400" />
            Business Manager
          </CardTitle>
          <CardDescription>
            Active planning lane for commerce, real estate, acquisition strategy, business credit, and R&amp;D-informed suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.businessOperations.status}</Badge>
            <Badge className={data.businessOperations.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.businessOperations.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["ecommerce", "E-commerce"],
              ["dropshipping", "Dropshipping"],
              ["realEstate", "Real Estate"],
              ["acquisitions", "Acquisitions"],
              ["businessCredit", "Business Credit"],
              ["rdSuggestions", "R&D Suggestions"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                className="border-white/10"
                onClick={() => toggleBusinessFlag(key as keyof IntegrationState["businessOperations"])}
              >
                {data.businessOperations[key as keyof IntegrationState["businessOperations"]] ? `Disable ${label}` : `Enable ${label}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-400" />
            Payroll + Gusto
          </CardTitle>
          <CardDescription>
            Payroll, contractor, onboarding, and reimbursement workflows for the Business Manager lane.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.gusto.status}</Badge>
            <Badge className="bg-cyan-500/20 text-cyan-200">Environment: {data.gusto.environment}</Badge>
            <Badge className={data.gusto.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.gusto.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Company ID</Label>
              <Input value={data.gusto.companyId} onChange={(e) => setData((prev) => ({ ...prev, gusto: { ...prev.gusto, companyId: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={data.gusto.clientId} onChange={(e) => setData((prev) => ({ ...prev, gusto: { ...prev.gusto, clientId: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input value={data.gusto.apiBaseUrl} onChange={(e) => setData((prev) => ({ ...prev, gusto: { ...prev.gusto, apiBaseUrl: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Webhook Base URL</Label>
              <Input value={data.gusto.webhookBaseUrl} onChange={(e) => setData((prev) => ({ ...prev, gusto: { ...prev.gusto, webhookBaseUrl: e.target.value } }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5 text-white" />
            GitHub
          </CardTitle>
          <CardDescription>
            Repository integration for repo health, pull request awareness, issues, and future operator workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.github.status}</Badge>
            <Badge className={data.github.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.github.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge className={data.github.hasToken ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-white/70"}>
              {data.github.hasToken ? "Token stored" : "No token"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Owner / Org</Label>
              <Input value={data.github.owner} onChange={(e) => setData((prev) => ({ ...prev, github: { ...prev.github, owner: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Repository</Label>
              <Input value={data.github.repo} onChange={(e) => setData((prev) => ({ ...prev, github: { ...prev.github, repo: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Default Branch</Label>
              <Input value={data.github.defaultBranch} onChange={(e) => setData((prev) => ({ ...prev, github: { ...prev.github, defaultBranch: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>GitHub API Base URL</Label>
              <Input value={data.github.apiBaseUrl} onChange={(e) => setData((prev) => ({ ...prev, github: { ...prev.github, apiBaseUrl: e.target.value } }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Personal Access Token</Label>
              <Input
                type="password"
                value={data.github.token}
                placeholder={data.github.hasToken ? "Stored token preserved unless replaced" : "Paste GitHub token"}
                onChange={(e) => setData((prev) => ({ ...prev, github: { ...prev.github, token: e.target.value } }))}
              />
            </div>
          </div>
          {githubStatus && <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">{githubStatus}</div>}
          {githubReadout && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium mb-2">Open Pull Requests</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {(githubReadout.pulls || []).length > 0 ? githubReadout.pulls!.map((pull) => (
                    <a key={pull.number} href={pull.url} target="_blank" rel="noreferrer" className="block hover:text-white">
                      #{pull.number} {pull.title}{pull.draft ? " (draft)" : ""}
                    </a>
                  )) : <p>No open pull requests returned.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium mb-2">Open Issues</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {(githubReadout.issues || []).length > 0 ? githubReadout.issues!.map((issue) => (
                    <a key={issue.number} href={issue.url} target="_blank" rel="noreferrer" className="block hover:text-white">
                      #{issue.number} {issue.title}
                    </a>
                  )) : <p>No open issues returned.</p>}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setData((prev) => ({ ...prev, github: { ...prev.github, enabled: !prev.github.enabled, status: prev.github.enabled ? "planned" : "configured" } }))}>
              {data.github.enabled ? "Disable GitHub" : "Enable GitHub"}
            </Button>
            <Button variant="outline" className="border-white/10" onClick={testGitHubConnection} disabled={githubTesting}>
              <RefreshCw className={`mr-2 h-4 w-4 ${githubTesting ? "animate-spin" : ""}`} />
              {githubTesting ? "Checking..." : "Test Connection"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-sky-400" />
            Executive Email
          </CardTitle>
          <CardDescription>
            Drafting, approval, and provider-backed send lane for the executive assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.email.status}</Badge>
            <Badge className={data.email.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.email.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge className={data.email.hasPassword ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-white/70"}>
              {data.email.hasPassword ? "Credential stored" : "No credential"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={data.email.provider} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, provider: e.target.value as any } }))} />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input value={data.email.fromName} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, fromName: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>From Address</Label>
              <Input value={data.email.fromAddress} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, fromAddress: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input value={data.email.smtpHost} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, smtpHost: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input value={String(data.email.smtpPort)} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, smtpPort: Number(e.target.value) || 587 } }))} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={data.email.username} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, username: e.target.value } }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Password / App Password</Label>
              <Input type="password" value={data.email.password} placeholder={data.email.hasPassword ? "Stored credential preserved unless replaced" : "Paste email credential"} onChange={(e) => setData((prev) => ({ ...prev, email: { ...prev.email, password: e.target.value } }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-amber-400" />
            Phone + Voicemail
          </CardTitle>
          <CardDescription>
            Telephony lane for call management, missed-call capture, voicemail summaries, and future voice assistant workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.telephony.status}</Badge>
            <Badge className={data.telephony.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.telephony.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge className={data.telephony.hasApiKey ? "bg-cyan-500/20 text-cyan-200" : "bg-white/10 text-white/70"}>
              {data.telephony.hasApiKey ? "Credential stored" : "No credential"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={data.telephony.provider} onChange={(e) => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, provider: e.target.value as any } }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={data.telephony.phoneNumber} onChange={(e) => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, phoneNumber: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Voicemail Summary Email</Label>
              <Input value={data.telephony.voicemailEmail} onChange={(e) => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, voicemailEmail: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Account SID / Tenant ID</Label>
              <Input value={data.telephony.accountSid} onChange={(e) => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, accountSid: e.target.value } }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>API Key / Token</Label>
              <Input type="password" value={data.telephony.apiKey} placeholder={data.telephony.hasApiKey ? "Stored credential preserved unless replaced" : "Paste telephony API key"} onChange={(e) => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, apiKey: e.target.value } }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setData((prev) => ({ ...prev, telephony: { ...prev.telephony, voiceAgentEnabled: !prev.telephony.voiceAgentEnabled } }))}>
              {data.telephony.voiceAgentEnabled ? "Disable Voice Agent" : "Enable Voice Agent"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-cyan-400" />
            R&amp;D Market Lane + Kalshi
          </CardTitle>
          <CardDescription>
            Planned market-research lane for stocks, crypto, prediction analysis, Kalshi contracts, and expansive keyword search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.kalshi.status}</Badge>
            <Badge className="bg-cyan-500/20 text-cyan-200">Environment: {data.kalshi.environment}</Badge>
            <Badge className={data.kalshi.enabled ? "bg-green-500/20 text-green-200" : "bg-white/10 text-white/70"}>
              {data.kalshi.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Kalshi API Base URL</Label>
              <Input value={data.kalshi.apiBaseUrl} onChange={(e) => setData((prev) => ({ ...prev, kalshi: { ...prev.kalshi, apiBaseUrl: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Account Email</Label>
              <Input value={data.kalshi.email} onChange={(e) => setData((prev) => ({ ...prev, kalshi: { ...prev.kalshi, email: e.target.value } }))} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">
            Expansive keyword search is part of the R&amp;D lane. It broadens prompts into related market, catalyst, and probability terms before synthesis so stock, crypto, and Kalshi reasoning has more context.
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-pink-400" />
            Voice Workflow
          </CardTitle>
          <CardDescription>
            Browser-first speech input today, with room for a future provider-backed transcription lane.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/10 text-white/70">Provider: {data.voiceTranscription.provider}</Badge>
            <Badge className="bg-yellow-500/20 text-yellow-200">Status: {data.voiceTranscription.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Integration Settings"}
      </Button>
    </div>
  );
}
