import { useEffect, useState } from "react";
import { Lock, RefreshCw, Router, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { AccessForm } from "./ruleset/AccessForm";
import { ParametersForm } from "./ruleset/ParametersForm";
import { PersonalityForm } from "./ruleset/PersonalityForm";
import { SecurityForm } from "./ruleset/SecurityForm";
import { SectionButton } from "./ruleset/form-atoms";
import {
  FILE_META,
  cloneDefaults,
  mergeDeep,
  type RulesetKey,
  type RulesetMap,
  type SaveStatus,
} from "./ruleset/meta";

export default function RulesetSection() {
  const [rulesets, setRulesets] = useState<RulesetMap>(cloneDefaults());
  const [activeFile, setActiveFile] = useState<RulesetKey>("personality.yaml");
  const [activeSection, setActiveSection] = useState("identity");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [parseIssues, setParseIssues] = useState<string[]>([]);

  const currentMeta = FILE_META[activeFile];
  const currentSectionMeta =
    currentMeta.sections.find((s) => s.key === activeSection) || currentMeta.sections[0];
  const currentRules = rulesets[activeFile];

  useEffect(() => {
    void loadRulesets();
  }, []);

  useEffect(() => {
    setActiveSection(FILE_META[activeFile].sections[0].key);
    setSaveStatus("idle");
  }, [activeFile]);

  async function loadRulesets() {
    setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/ruleset/structured", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load ruleset");
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

  function updateCurrentFile(updater: (draft: any) => void) {
    setRulesets((prev) => {
      const next = cloneDefaults();
      Object.assign(next, prev);
      const current = JSON.parse(JSON.stringify(prev[activeFile]));
      updater(current);
      next[activeFile] = current;
      return next;
    });
    setSaveStatus("idle");
  }

  async function saveActiveFile() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/ruleset/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: activeFile, content: rulesets[activeFile] }),
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

  function renderForm() {
    if (activeFile === "personality.yaml") {
      return <PersonalityForm file={currentRules} activeSection={activeSection} update={updateCurrentFile} />;
    }
    if (activeFile === "security.yaml") {
      return <SecurityForm file={currentRules} activeSection={activeSection} update={updateCurrentFile} />;
    }
    if (activeFile === "parameters.yaml") {
      return <ParametersForm file={currentRules} activeSection={activeSection} update={updateCurrentFile} />;
    }
    return <AccessForm file={currentRules} activeSection={activeSection} update={updateCurrentFile} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Ruleset Control Center</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Edit each rules domain through structured controls instead of raw YAML. Pick a rules
            file first, then work inside a single focused section with fields that match the real
            config shape.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/10"
          onClick={loadRulesets}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Reload Ruleset
        </Button>
      </div>

      {parseIssues.length > 0 ? (
        <Card className="border-amber-400/20 bg-amber-400/5">
          <CardContent className="pt-4 text-sm text-amber-100">
            <div className="mb-2 font-medium">Some rules files could not be parsed cleanly.</div>
            <ul className="space-y-1 text-xs text-amber-200/80">
              {parseIssues.map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(FILE_META) as RulesetKey[]).map((key) => {
          const meta = FILE_META[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFile(key)}
              className={[
                "rounded-2xl border px-4 py-4 text-left transition-all",
                activeFile === key
                  ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
                  : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                  <Icon
                    size={15}
                    className={activeFile === key ? "text-cyan-300" : "text-foreground/70"}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    {activeFile === key ? (
                      <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">
                        Active
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground">{meta.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Router size={16} className="text-cyan-300" />
              {currentMeta.label} Sections
            </CardTitle>
            <CardDescription>
              Choose the exact section you want to configure. Each section opens as a focused form
              instead of a raw document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentMeta.sections.map((section) => (
              <SectionButton
                key={section.key}
                active={activeSection === section.key}
                label={section.label}
                description={section.description}
                onClick={() => setActiveSection(section.key)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="zed-glass border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock size={16} className="text-purple-300" />
              {currentSectionMeta.label}
            </CardTitle>
            <CardDescription>
              {currentSectionMeta.description} This saves back into{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px]">{activeFile}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="py-10 text-sm text-muted-foreground">
                Loading structured ruleset controls...
              </div>
            ) : (
              <>
                {renderForm()}
                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                  <Button
                    onClick={saveActiveFile}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Save size={14} className="mr-2" />
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                        ? "Saved!"
                        : saveStatus === "error"
                          ? "Save Failed"
                          : `Save ${currentMeta.label}`}
                  </Button>
                  {saveStatus === "error" ? (
                    <span className="text-xs text-red-400">
                      Could not save this rules file. Check field values and try again.
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
