import {
  Brain,
  Cable,
  Fingerprint,
  FolderKanban,
  Network,
  PanelLeft,
  Settings,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Brain,
  Cable,
  Fingerprint,
  FolderKanban,
  Network,
  PanelsTopLeft: PanelLeft,
  Settings,
  Sparkles,
  Wrench,
};

export function NexysIcon({
  name,
  size = 18,
  className,
}: {
  readonly name: string;
  readonly size?: number;
  readonly className?: string;
}) {
  const Icon = iconMap[name] ?? Sparkles;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

/** Same icon-name -> component resolution as NexysIcon, for non-DOM consumers (e.g. the NexysCore scene adapter). */
export function resolveNexysIconComponent(name: string): LucideIcon {
  return iconMap[name] ?? Sparkles;
}
