import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ApprovalMode,
  ApprovalSettings,
} from "../../../../../../shared/adminSettings";

import {
  LoadErrorBanner,
  SaveIndicator,
  Segmented,
  SettingGroup,
  SettingRow,
} from "./atoms";

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
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<boolean>(false);
  const savedTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      if (data?.approvals) {
        setApprovals(data.approvals as ApprovalSettings);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const flush = useCallback(async (patch: Partial<ApprovalSettings>) => {
    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/admin/settings/approvals", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
      const normalized = (await res.json()) as ApprovalSettings;
      setApprovals(normalized);
      setStatus("saved");
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
    } catch (err: any) {
      setErrorMessage(err?.message);
      setStatus("error");
    }
  }, []);

  const set = useCallback(
    (key: CategoryKey, value: ApprovalMode) => {
      // Optimistic — the user sees the click take effect immediately.
      // If the server disagrees, the normalized response replaces it.
      setApprovals((prev) => ({ ...prev, [key]: value }));
      void flush({ [key]: value });
    },
    [flush],
  );

  const totalItems = useMemo(
    () => GROUPS.reduce((n, g) => n + g.items.length, 0),
    [],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex w-full min-w-0 max-w-full flex-wrap items-start justify-between gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            What needs your approval
          </h2>
          <p className="mt-1.5 max-w-full break-words text-[13.5px] leading-snug text-white/50 [overflow-wrap:anywhere] sm:max-w-[62ch]">
            For each thing ZAR might do on your behalf, choose whether ZAR goes
            ahead automatically, drafts and asks you first, or never does it at
            all.{" "}
            <span className="text-white/35">
              ({totalItems} settings, tap a group to collapse)
            </span>
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage, totalItems],
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      {header}
      {loadError && <LoadErrorBanner onRetry={() => void load()} />}

      {GROUPS.map((group, groupIndex) => (
        <SettingGroup
          key={group.title}
          title={group.title}
          count={group.items.length}
          collapsible
          // Keep the first group open by default; collapse the rest for scanability.
          defaultCollapsed={groupIndex > 0}
        >
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

    </div>
  );
}
