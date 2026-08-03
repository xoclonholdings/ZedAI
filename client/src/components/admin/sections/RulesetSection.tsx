import { useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

import {
  SettingGroup,
  SettingRow,
} from "./settings/atoms";
import type { AdminSection } from "../types";

import { AccessForm } from "./ruleset/AccessForm";
import { ParametersForm } from "./ruleset/ParametersForm";
import { PersonalityForm } from "./ruleset/PersonalityForm";
import { SecurityForm } from "./ruleset/SecurityForm";
import {
  FILE_META,
  cloneDefaults,
  mergeDeep,
  type RulesetKey,
  type RulesetMap,
  type SaveStatus,
} from "./ruleset/meta";
import { useEffect } from "react";

/**
 * Plain-language Advanced → Raw Rules.
 *
 * The old surface exposed four YAML files (personality, security,
 * parameters, access) with 5-6 sub-sections each. Most users had no
 * idea what "Decision Rules" or "Trust Model" meant, and 95% of
 * those settings already have a friendly version somewhere in the
 * Settings tab. This surface says so honestly:
 *
 *   For each of the four rules files, one row explains what it
 *   controls and where the plain-language version lives. The raw
 *   form editor sits behind a "Show raw editor" toggle — it still
 *   works, but it's off by default because a normal user should
 *   never need it.
 */

interface RuleGroup {
  key: RulesetKey;
  label: string;
  purpose: string;
  friendlyLocation: string;
  /** Which top-level Admin tab actually hosts the friendly version of this rule group. */
  friendlyTab: AdminSection;
}

const RULE_GROUPS: RuleGroup[] = [
  {
    key: "personality.yaml",
    label: "ZAR's personality",
    purpose:
      "Identity, tone, formality, when to ask clarifying questions, response style.",
    friendlyLocation: "Settings → How ZAR sounds (Admin panel)",
    friendlyTab: "settings",
  },
  {
    key: "security.yaml",
    label: "Approval rules & sensitive topics",
    purpose:
      "What actions need your OK, how long approvals stay pending, topics ZAR handles carefully.",
    friendlyLocation: "Settings → What needs your approval (Admin panel)",
    friendlyTab: "settings",
  },
  {
    key: "parameters.yaml",
    label: "Model tuning",
    purpose:
      "Temperature, token budgets, model choice, per-agent overrides. Most of this is auto-derived from your Voice settings.",
    friendlyLocation: "Settings → How ZAR sounds — the sliders derive these",
    friendlyTab: "settings",
  },
  {
    key: "access.yaml",
    label: "External services & paths",
    purpose:
      "Which outside services ZAR is allowed to reach, filesystem layout, single-user vs multi-user mode.",
    friendlyLocation: "Connections tab (Admin panel)",
    friendlyTab: "integrations",
  },
];

export default function RulesetSection() {
  const [, navigate] = useLocation();
  const [rulesets, setRulesets] = useState<RulesetMap>(cloneDefaults());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawFor, setRawFor] = useState<RulesetKey | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [parseIssues, setParseIssues] = useState<string[]>([]);

  useEffect(() => {
    void loadRulesets();
  }, []);

  async function loadRulesets() {
    setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/ruleset/structured", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load ruleset (HTTP ${res.status})`);
      const raw = await res.json();
      const merged = cloneDefaults();
      const issues: string[] = [];
      (Object.keys(FILE_META) as RulesetKey[]).forEach((file) => {
        try {
          merged[file] = mergeDeep(merged[file], raw[file] || {});
        } catch (error: any) {
          issues.push(`${FILE_META[file].label}: ${error.message || "invalid YAML"}`);
        }
      });
      setRulesets(merged);
      setParseIssues(issues);
    } catch (error: any) {
      setParseIssues([error.message || "Failed to load ruleset"]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function updateFile(file: RulesetKey, updater: (draft: any) => void) {
    setRulesets((prev) => {
      const next = cloneDefaults();
      Object.assign(next, prev);
      const current = JSON.parse(JSON.stringify(prev[file]));
      updater(current);
      next[file] = current;
      return next;
    });
    setSaveStatus("idle");
  }

  async function saveFile(file: RulesetKey) {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/ruleset/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: file, content: rulesets[file] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1800);
    } catch {
      setSaveStatus("error");
    }
  }

  function renderForm(file: RulesetKey, section: string) {
    const props = {
      file: rulesets[file],
      activeSection: section,
      update: (updater: (draft: any) => void) => updateFile(file, updater),
    };
    if (file === "personality.yaml") return <PersonalityForm {...props} />;
    if (file === "security.yaml") return <SecurityForm {...props} />;
    if (file === "parameters.yaml") return <ParametersForm {...props} />;
    return <AccessForm {...props} />;
  }

  function openRaw(file: RulesetKey) {
    if (rawFor === file) {
      setRawFor(null);
      return;
    }
    setRawFor(file);
    setActiveSection(FILE_META[file].sections[0].key);
  }

  return (
    <div className="min-w-0">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Rules (engineer view)
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            The lower-level rules that shape ZAR's behavior. Most people never
            need to open this — the friendly version of each rule lives in
            Settings or Connections. Only touch these if you know exactly
            what you're changing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRulesets()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Reload
        </button>
      </header>

      {parseIssues.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-[12.5px] text-amber-200">
          <div className="font-medium mb-1">Some rules files couldn't be parsed cleanly.</div>
          <ul className="space-y-0.5 text-[11.5px] text-amber-200/80">
            {parseIssues.map((issue) => (
              <li key={issue}>· {issue}</li>
            ))}
          </ul>
        </div>
      )}

      <SettingGroup title="Rules by domain">
        {RULE_GROUPS.map((group) => (
          <div key={group.key} className="border-t border-white/[0.06] first:border-t-0">
            <SettingRow
              label={group.label}
              description={`${group.purpose}\n\nThe plain-language version: ${group.friendlyLocation}`}
              stack
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/admin?tab=${group.friendlyTab}`)}
                  className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
                >
                  Go to the friendly version
                </button>
                <button
                  type="button"
                  onClick={() => openRaw(group.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
                >
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${rawFor === group.key ? "rotate-180" : ""}`}
                  />
                  {rawFor === group.key ? "Hide raw editor" : "Show raw editor"}
                </button>
              </div>
            </SettingRow>

            {rawFor === group.key && !loading && (
              <div className="pl-2 pr-2 pb-4 border-t border-white/[0.04] bg-white/[0.01]">
                <div className="pt-3 mb-3">
                  <label className="block text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1.5">
                    Section
                  </label>
                  <select
                    value={activeSection}
                    onChange={(e) => setActiveSection(e.target.value)}
                    className="w-full max-w-xs h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                  >
                    {FILE_META[group.key].sections.map((s) => (
                      <option key={s.key} value={s.key} className="bg-neutral-900">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11.5px] text-white/40">
                    {FILE_META[group.key].sections.find((s) => s.key === activeSection)?.description}
                  </p>
                </div>

                {renderForm(group.key, activeSection)}

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveFile(group.key)}
                    disabled={saveStatus === "saving"}
                    className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
                  >
                    {saveStatus === "saving"
                      ? "Saving…"
                      : saveStatus === "saved"
                        ? "Saved"
                        : saveStatus === "error"
                          ? "Retry save"
                          : "Save changes"}
                  </button>
                  {saveStatus === "error" && (
                    <span className="text-[11.5px] text-red-300">
                      Save failed. Check field values.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </SettingGroup>
    </div>
  );
}
