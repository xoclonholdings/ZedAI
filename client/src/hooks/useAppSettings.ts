import { useEffect, useRef, useState } from "react";

import type { AppSettings } from "@shared/adminSettings";
import { defaultAppSettings } from "@shared/adminSettings";

export type { AppSettings } from "@shared/adminSettings";

const LOCAL_APP_SETTINGS_KEY = "zed_app_settings";

function readLocalAppSettings(): Partial<AppSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_APP_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(LOCAL_APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Local persistence is best-effort only.
  }
}

export function useAppSettings() {
  const [appSettings, setAppSettingsState] = useState<AppSettings>({
    ...defaultAppSettings,
    ...readLocalAppSettings(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const hydratedRef = useRef(false);
  const canSyncAdminSettingsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const localSettings = readLocalAppSettings();
      try {
        const response = await fetch("/api/admin/settings", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Admin settings unavailable");
        }

        const data = await response.json();
        if (!cancelled) {
          canSyncAdminSettingsRef.current = true;
          setAppSettingsState({ ...defaultAppSettings, ...(data.app || {}), ...localSettings });
          hydratedRef.current = true;
        }
      } catch {
        if (!cancelled) {
          canSyncAdminSettingsRef.current = false;
          setAppSettingsState({ ...defaultAppSettings, ...localSettings });
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

      writeLocalAppSettings(next);

      if (hydratedRef.current && canSyncAdminSettingsRef.current) {
        void fetch("/api/admin/settings/app", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(next),
        }).catch(() => {
          canSyncAdminSettingsRef.current = false;
        });
      }

      return next;
    });
  };

  return { appSettings, setAppSettings, isLoading };
}

export async function clearAppSettings() {
  try {
    localStorage.removeItem(LOCAL_APP_SETTINGS_KEY);
  } catch {
    // ignore local reset errors in destructive reset flow
  }

  try {
    await fetch("/api/admin/settings/app/reset", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore admin reset errors for non-admin users
  }
}
