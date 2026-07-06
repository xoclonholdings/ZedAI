import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ApprovalMode,
  ApprovalSettings,
} from "../../../../../../shared/adminSettings";

import { SaveIndicator, Segmented, SettingGroup, SettingRow } from "./atoms";

/**
 * Second plain-language Settings section — replaces the raw
 * security.yaml permission-tier editor with three-way toggles per
 * concrete action. Saves autosave-debounced. On the server side
 * the runtime consults these values via approvalPolicy.ts.
 */

type CategoryKey = keyof ApprovalSettings;

interface CategoryDef {
  key: CategoryKey;
  label: string;
  description: string;
}

const GROUPS: Array<{ title: string; items: CategoryDef[] }> = [
  {
    title: "Communication",
    items: [
      { key: "sendEmail", label: "Send emails", description: "Send outbound email through any configured account." },
      { key: "sendMessage", label: "Send text messages", description: "Send SMS or direct messages." },
      {
        key: "reachOutToContacts",
        label: "Reach out to contacts",
        description: "Cold outreach, follow-ups, and introductions.",
      },
    ],
  },
  {
    title: "Scheduling",
    items: [
      {
        key: "scheduleCalendar",
        label: "Schedule calendar items",
        description: "Create meetings, appointments, or calendar entries.",
      },
      {
        key: "cancelAppointment",
        label: "Cancel appointments",
        description: "Remove or move existing calendar items.",
      },
      {
        key: "createTask",
        label: "Create tasks",
        description: "Add to-dos or tasks for you to see later.",
      },
    ],
  },
  {
    title: "Content",
    items: [
      { key: "postToSocial", label: "Post to social media", description: "Publish anywhere connected to your accounts." },
      {
        key: "publishContent",
        label: "Publish content",
        description: "Push articles, videos, or episodes live.",
      },
    ],
  },
  {
    title: "Money & data",
    items: [
      { key: "makePayment", label: "Make payments", description: "Send money, run charges, or trigger transfers." },
      { key: "sendInvoice", label: "Send invoices", description: "Invoice a client or customer." },
      {
        key: "deleteData",
        label: "Delete data",
        description: "Wipe records, clear history, or delete files.",
      },
      {
        key: "updateCredentials",
        label: "Update credentials",
        description: "Change passwords, rotate keys, or update stored credentials.",
      },
    ],
  },
  {
    title: "Development",
    items: [
      { key: "deployCode", label: "Deploy code", description: "Push to production or run releases." },
    ],
  },
];

const MODE_OPTIONS: Array<{ value: ApprovalMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "ask", label: "Ask me" },
  { value: "never", label: "Never" },
];

const DEFAULTS: ApprovalSettings = {
  sendEmail: "ask",
  scheduleCalendar: "ask",
  cancelAppointment: "ask",
  sendMessage: "ask",
  reachOutToContacts: "ask",
  postToSocial: "ask",
  publishContent: "ask",
  makePayment: "ask",
  sendInvoice: "ask",
  deleteData: "ask",
  updateCredentials: "ask",
  deployCode: "ask",
  createTask: "auto",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function WhatNeedsApproval() {
  const [approvals, setApprovals] = useState<ApprovalSettings>(DEFAULTS);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.approvals) setApprovals(data.approvals as ApprovalSettings);
      } catch {
        // silent — DEFAULTS keep the UI operable until first save.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async (patch: Partial<ApprovalSettings>) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/approvals", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
      const normalized = (await res.json()) as ApprovalSettings;
      setApprovals(normalized);
      setStatus("saved");
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }, []);

  const set = useCallback(
    (key: CategoryKey, value: ApprovalMode) => {
      setApprovals((prev) => ({ ...prev, [key]: value }));
      void flush({ [key]: value });
    },
    [flush],
  );

  const onReset = useCallback(async () => {
    if (!window.confirm("Reset ‘What needs your approval’ to defaults?")) return;
    try {
      setStatus("saving");
      const res = await fetch("/api/admin/settings/approvals/reset", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Reset failed");
      const next = (await res.json()) as ApprovalSettings;
      setApprovals(next);
      setStatus("saved");
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }, []);

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            What needs your approval
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-[62ch] leading-snug">
            For each thing Zed might do on your behalf, choose whether Zed goes
            ahead automatically, drafts and asks you first, or never does it at
            all.
          </p>
        </div>
        <SaveIndicator status={status} />
      </header>
    ),
    [status],
  );

  return (
    <div>
      {header}

      {GROUPS.map((group) => (
        <SettingGroup key={group.title} title={group.title}>
          {group.items.map((item) => (
            <SettingRow key={item.key} label={item.label} description={item.description}>
              <Segmented<ApprovalMode>
                options={MODE_OPTIONS}
                value={approvals[item.key]}
                onChange={(v) => set(item.key, v)}
                ariaLabel={item.label}
              />
            </SettingRow>
          ))}
        </SettingGroup>
      ))}

      <div className="flex justify-end pt-5 mt-8 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] text-white/50 hover:text-red-300 hover:bg-white/[0.04] px-3 py-1.5 rounded-md transition-colors"
        >
          Reset this section to defaults
        </button>
      </div>
    </div>
  );
}
