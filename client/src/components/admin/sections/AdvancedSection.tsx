import { useState } from "react";
import { ChevronDown } from "lucide-react";

import ToolsSection from "./FlowsSection";
import RulesetSection from "./RulesetSection";
import ZyncCodingOperatorSection from "./ZyncCodingOperatorSection";
import EnvValidatorCard from "../EnvValidatorCard";
import ProviderDiagnosticsCard from "../ProviderDiagnosticsCard";

/**
 * Consolidated "Advanced" tab.
 *
 * Tools (the flow engine — reusable actions ZAR knows how to run)
 * and Rules (the raw YAML ruleset the Settings tab is the friendly
 * front for) both used to be their own tabs. Neither is something a
 * normal user needs to open — Tools is for authoring executable
 * actions, Rules is the engineer escape hatch. Rather than confuse
 * users with two tabs neither of them needs, this tab hosts both
 * behind collapsed sections.
 */
export default function AdvancedSection() {
  const [openDiagnostics, setOpenDiagnostics] = useState<boolean>(true);
  const [openZync, setOpenZync] = useState<boolean>(false);
  const [openTools, setOpenTools] = useState<boolean>(false);
  const [openRules, setOpenRules] = useState<boolean>(false);

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
          Advanced
        </h2>
        <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
          Stuff you probably don't need. Everything here has a friendly version
          somewhere else in Settings — this tab is the engineer view. Only open
          a section if you know exactly what you're changing.
        </p>
      </header>

      <Section
        title="AI host diagnostics"
        subtitle="Provider routing, environment validation, and live host probes for the models ZAR is about to call."
        open={openDiagnostics}
        onToggle={() => setOpenDiagnostics((v) => !v)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ProviderDiagnosticsCard />
          <EnvValidatorCard />
        </div>
      </Section>

      <Section
        title="Zync coding operator"
        subtitle="Repo-aware coding functions ZAR can run now, stored in a Zync-branded core-memory module for later extraction into the Zync app."
        open={openZync}
        onToggle={() => setOpenZync((v) => !v)}
      >
        <ZyncCodingOperatorSection />
      </Section>

      <Section
        title="Tools ZAR can run"
        subtitle="Reusable actions ZAR can execute when you approve — send email, generate a report, run a workflow. Managed through the flow engine."
        open={openTools}
        onToggle={() => setOpenTools((v) => !v)}
      >
        <ToolsSection />
      </Section>

      <Section
        title="Raw rules"
        subtitle="The YAML rulesets that Settings is the plain-language front for. Editing here overrides what you set in Settings."
        open={openRules}
        onToggle={() => setOpenRules((v) => !v)}
      >
        <RulesetSection />
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-7 mt-7 border-t border-white/[0.06] first:pt-0 first:mt-0 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 text-left group"
      >
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-white/90 group-hover:text-white transition-colors">
            {title}
          </div>
          <div className="mt-1 text-[13px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            {subtitle}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 mt-1 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && <div className="mt-5">{children}</div>}
    </section>
  );
}
