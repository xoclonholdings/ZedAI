import { useEffect, useRef, useState } from "react";

import type { AppSettings } from "@shared/adminSettings";
import { defaultAppSettings } from "@shared/adminSettings";

export type { AppSettings } from "@shared/adminSettings";

export function useAppSettings() {
  const [appSettings, setAppSettingsState] = useState<AppSettings>(defaultAppSettings);
  const [isLoading, setIsLoading] = useState(true);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/settings", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load app settings");
        }

        const data = await response.json();
        if (!cancelled) {
          setAppSettingsState({ ...defaultAppSettings, ...(data.app || {}) });
          hydratedRef.current = true;
        }
      } catch {
        if (!cancelled) {
          setAppSettingsState(defaultAppSettings);
          hydratedRef.current = true;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>> = (update) => {
    setAppSettingsState((prev) => {
      const next = typeof update === "function" ? (update as (value: AppSettings) => AppSettings)(prev) : update;

      if (hydratedRef.current) {
        void fetch("/api/admin/settings/app", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(next),
        }).catch(() => {});
      }

      return next;
    });
  };

  return { appSettings, setAppSettings, isLoading };
}

export async function clearAppSettings() {
  try {
    await fetch("/api/admin/settings/app/reset", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore reset errors in destructive reset flow
  }
}
