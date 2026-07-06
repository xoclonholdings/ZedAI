/**
 * The 8 plain-language Settings categories that replace the four-tab
 * YAML editor. Only the ones with `ready: true` render real controls;
 * the rest show a "coming soon" placeholder until their PR lands.
 */

export type SettingsCategoryId =
  | "voice"
  | "approval"
  | "tools"
  | "length-style"
  | "sensitive"
  | "session-safety"
  | "personal-memory";

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  description: string;
  ready: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "voice",
    label: "How Zed sounds",
    description:
      "Set the voice Zed uses when it talks to you. Tone, formality, and what Zed avoids saying.",
    ready: true,
  },
  {
    id: "approval",
    label: "What needs your approval",
    description:
      "For each thing Zed might do — send emails, post, pay, delete — choose Auto, Ask me, or Never.",
    ready: true,
  },
  {
    id: "tools",
    label: "Tools Zed can use",
    description:
      "Which integrations and services Zed is allowed to reach for.",
    ready: false,
  },
  {
    id: "length-style",
    label: "Response length & style",
    description:
      "How long Zed’s answers are, how they’re formatted, whether it explains its reasoning.",
    ready: false,
  },
  {
    id: "sensitive",
    label: "Sensitive topics",
    description:
      "Topics Zed should handle with extra care or avoid entirely.",
    ready: false,
  },
  {
    id: "session-safety",
    label: "Session & safety",
    description:
      "Session timeout, lockouts, and login safety.",
    ready: false,
  },
  {
    id: "personal-memory",
    label: "Personal memory",
    description:
      "What Zed knows about you and how it uses that knowledge.",
    ready: false,
  },
];
