import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";

interface UserSecret {
  id: string;
  label: string;
  createdAt: string;
}

const SECRETS_QUERY_KEY = ["/api/me/secrets"];

/**
 * The user's own secrets vault - independent of the shared admin-wide
 * integrations, so anyone can add a credential ZAR can reference for their
 * own requests, admin or not. Values are write-only from here: once saved,
 * only the label and date come back, never the value itself.
 */
export function SecretsVault({ prefillLabel }: { readonly prefillLabel?: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState(prefillLabel ?? "");
  const [value, setValue] = useState("");

  const { data } = useQuery<{ secrets: UserSecret[] }>({ queryKey: SECRETS_QUERY_KEY });
  const secrets = data?.secrets ?? [];

  useEffect(() => {
    if (prefillLabel) {
      setLabel(prefillLabel);
      setShowForm(true);
    }
    // Only react to a new prefill request, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillLabel]);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/me/secrets", { label: label.trim(), value: value.trim() });
      return res.json();
    },
    onSuccess: async () => {
      setLabel("");
      setValue("");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: SECRETS_QUERY_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/me/secrets/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SECRETS_QUERY_KEY }),
  });

  return (
    <section id="secrets-vault" className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Secrets</div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[11.5px] text-cyan-300 hover:text-cyan-200"
          >
            <Plus size={13} />
            Add secret
          </button>
        )}
      </div>
      <p className="mb-2 text-[11.5px] leading-snug text-white/40">
        Your own credentials for ZAR to use - separate from the shared integrations above. Only you can see these, and once saved the value itself is never shown again.
      </p>

      {showForm && (
        <div className="mb-2 space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.03] p-3">
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="What is this for? e.g. Shopify API key"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
          />
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Value"
            autoComplete="new-password"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending || !label.trim() || !value.trim()}
              className="flex-1 rounded-lg bg-cyan-400 px-3 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
            >
              {create.isPending ? "Saving…" : "Save secret"}
            </button>
          </div>
        </div>
      )}

      {secrets.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center text-[12px] text-white/40">
          No secrets added yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {secrets.map((secret) => (
            <div
              key={secret.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <KeyRound size={13} className="shrink-0 text-cyan-300/70" />
                <span className="truncate text-[13px] text-white/85">{secret.label}</span>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(secret.id)}
                disabled={remove.isPending}
                aria-label={`Remove ${secret.label}`}
                className="shrink-0 text-white/40 hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
