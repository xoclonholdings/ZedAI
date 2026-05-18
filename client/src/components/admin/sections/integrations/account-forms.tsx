import { Input } from "@/components/ui/input";

import { FieldRow } from "./shared";

export function GitHubAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <FieldRow label="Label">
        <Input
          value={account.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="Personal repos"
        />
      </FieldRow>
      <FieldRow label="Default branch">
        <Input
          value={account.defaultBranch || ""}
          onChange={(e) => onUpdate({ defaultBranch: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="main"
        />
      </FieldRow>
      <FieldRow label="Owner">
        <Input
          value={account.owner || ""}
          onChange={(e) => onUpdate({ owner: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="xoclonholdings"
        />
      </FieldRow>
      <FieldRow label="Repo">
        <Input
          value={account.repo || ""}
          onChange={(e) => onUpdate({ repo: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="ZedAI"
        />
      </FieldRow>
      <div className="col-span-2">
        <FieldRow label={account.hasToken ? "Token (saved)" : "Token"}>
          <Input
            type="password"
            value={account.token || ""}
            onChange={(e) => onUpdate({ token: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9 font-mono"
            placeholder={account.hasToken ? "•••••• — paste to replace" : "ghp_…"}
          />
        </FieldRow>
      </div>
    </div>
  );
}

export function EmailAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <FieldRow label="Label">
        <Input
          value={account.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="Personal Gmail"
        />
      </FieldRow>
      <FieldRow label="Provider">
        <select
          value={account.provider || "smtp"}
          onChange={(e) => onUpdate({ provider: e.target.value })}
          className="w-full h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm"
        >
          <option value="smtp">SMTP</option>
          <option value="gmail">Gmail</option>
          <option value="outlook">Outlook</option>
          <option value="icloud">iCloud</option>
          <option value="custom">Custom</option>
        </select>
      </FieldRow>
      <FieldRow label="From name">
        <Input
          value={account.fromName || ""}
          onChange={(e) => onUpdate({ fromName: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="ZED"
        />
      </FieldRow>
      <FieldRow label="From address">
        <Input
          type="email"
          value={account.fromAddress || ""}
          onChange={(e) => onUpdate({ fromAddress: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="zed@example.com"
        />
      </FieldRow>
      <FieldRow label="SMTP host">
        <Input
          value={account.smtpHost || ""}
          onChange={(e) => onUpdate({ smtpHost: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="smtp.gmail.com"
        />
      </FieldRow>
      <FieldRow label="Port">
        <Input
          type="number"
          value={account.smtpPort || 587}
          onChange={(e) => onUpdate({ smtpPort: Number(e.target.value) || 587 })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
        />
      </FieldRow>
      <FieldRow label="Username">
        <Input
          value={account.username || ""}
          onChange={(e) => onUpdate({ username: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
        />
      </FieldRow>
      <FieldRow label={account.hasPassword ? "Password (saved)" : "Password"}>
        <Input
          type="password"
          value={account.password || ""}
          onChange={(e) => onUpdate({ password: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasPassword ? "•••••• — paste to replace" : "app password"}
        />
      </FieldRow>
    </div>
  );
}

export function GoogleAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  const toggleScope = (scope: string) => {
    const next = (account.scopes || []).includes(scope)
      ? (account.scopes || []).filter((s: string) => s !== scope)
      : [...(account.scopes || []), scope];
    onUpdate({ scopes: next });
  };
  const COMMON_SCOPES: Array<{ key: string; label: string }> = [
    { key: "https://www.googleapis.com/auth/gmail.send", label: "Gmail send" },
    { key: "https://www.googleapis.com/auth/gmail.readonly", label: "Gmail read" },
    { key: "https://www.googleapis.com/auth/calendar", label: "Calendar" },
    { key: "https://www.googleapis.com/auth/drive.readonly", label: "Drive read" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <FieldRow label="Label">
          <Input
            value={account.label || ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9"
            placeholder="Personal Gmail"
          />
        </FieldRow>
        <FieldRow label="Google email">
          <Input
            type="email"
            value={account.email || ""}
            onChange={(e) => onUpdate({ email: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9"
            placeholder="you@gmail.com"
          />
        </FieldRow>
      </div>
      <FieldRow label="Client ID">
        <Input
          value={account.clientId || ""}
          onChange={(e) => onUpdate({ clientId: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="123...apps.googleusercontent.com"
        />
      </FieldRow>
      <FieldRow label={account.hasCredentials ? "Client secret (saved)" : "Client secret"}>
        <Input
          type="password"
          value={account.clientSecret || ""}
          onChange={(e) => onUpdate({ clientSecret: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasCredentials ? "•••••• — paste to replace" : "GOCSPX-…"}
        />
      </FieldRow>
      <FieldRow label={account.hasCredentials ? "Refresh token (saved)" : "Refresh token"}>
        <Input
          type="password"
          value={account.refreshToken || ""}
          onChange={(e) => onUpdate({ refreshToken: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasCredentials ? "•••••• — paste to replace" : "1//…"}
        />
      </FieldRow>
      <FieldRow label="Scopes">
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COMMON_SCOPES.map((s) => {
            const on = (account.scopes || []).includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleScope(s.key)}
                className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  on
                    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </FieldRow>
    </div>
  );
}
