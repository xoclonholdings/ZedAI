import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";

import { ConsoleShell } from "@/console/ConsoleShell";
import { NexysConsoleHeaderBrand, NexysConsoleHeaderTelemetry } from "@/nexys/components/NexysConsoleHeader";
import NexysCore from "@/nexys/components/NexysCore";
import { nexysDomainsFromRootNodes } from "@/nexys/scene/nexysDomainAdapter";
import { canUseNexysWebgl } from "@/nexys/scene/nexysSceneContract";
import { useNexys } from "@/nexys/state/NexysProvider";

import { galaxyById } from "./galaxyConstellation";

/**
 * Themed galaxy workspace shared by every non-ZAR star gateway.
 *
 * It reuses ZAR's exact console shell + celestial scene, but takes on the
 * focused galaxy's own vibe: the star accent tints the whole world, the core
 * orb wears the galaxy's name, and the header/dock identity carries its
 * second name (ZENO -> UNITE, ZENITH -> LOGOS, ...). ZAR keeps its own full
 * workspace at /nexys; unknown ids bounce back to the map.
 */
export default function GalaxyWorkspacePage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { snapshot } = useNexys();
  const [dockPowered, setDockPowered] = useState(false);
  const [webgl, setWebgl] = useState(true);

  const galaxy = galaxyById(params.id);
  const invalid = !galaxy || galaxy.id === "zar";

  const domains = useMemo(() => nexysDomainsFromRootNodes(snapshot.rootNodes), [snapshot.rootNodes]);

  useEffect(() => setWebgl(canUseNexysWebgl()), []);

  useEffect(() => {
    if (invalid) navigate(galaxy?.id === "zar" ? "/nexys" : "/");
  }, [invalid, galaxy, navigate]);

  if (invalid || !galaxy) return null;

  const identity = { galaxy: galaxy.name, console: galaxy.console, accent: galaxy.accent };

  return (
    <ConsoleShell
      identity={identity}
      dockPowered={dockPowered}
      onDockPowerChange={setDockPowered}
      headerLeft={
        <NexysConsoleHeaderBrand
          onWordmarkClick={() => navigate("/")}
          wordmarkAriaLabel="Back to the Zebulon Galaxy map"
          context={{ label: galaxy.console, color: galaxy.accent }}
        />
      }
      headerRightExtra={<NexysConsoleHeaderTelemetry visible />}
    >
      <div className="absolute inset-0" data-nexys-region="scene" data-testid={`galaxy-workspace-${galaxy.id}`}>
        {webgl ? (
          <NexysCore
            domains={domains}
            label={galaxy.name}
            atmosphere={galaxy.accent}
            onCoreTap={() => navigate("/")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/50">
            {galaxy.name} needs a WebGL-capable browser to render its galaxy.
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 85% 70% at 50% 45%, ${galaxy.accent}30 0%, ${galaxy.accent}14 42%, transparent 78%)`,
        }}
        aria-hidden="true"
      />
    </ConsoleShell>
  );
}
