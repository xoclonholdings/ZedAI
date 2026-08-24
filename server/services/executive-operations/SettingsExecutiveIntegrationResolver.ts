import { loadAdminSettings } from "../AdminSettingsStore";
import type {
  ExecutiveIntegrationRequirement,
  ExecutiveIntegrationResolver,
  ExecutiveIntegrationStatus,
} from "./types";

/**
 * Reads connection metadata without exposing credentials. The current
 * admin-settings schema does not bind accounts to a ZCOS owner and no
 * executive-operation provider adapters are registered here, so both facts
 * remain explicit instead of being inferred from credential presence.
 */
export class SettingsExecutiveIntegrationResolver
  implements ExecutiveIntegrationResolver {
  async resolve(
    _owner_user_id: string,
    requirement: ExecutiveIntegrationRequirement,
  ): Promise<ExecutiveIntegrationStatus> {
    const settings = await loadAdminSettings().catch(() => null);
    if (!settings) {
      return {
        integration: requirement.integration,
        configured: false,
        owner_bound: false,
        adapter_available: false,
        granted_scopes: [],
        detail: "Integration settings are unavailable.",
      };
    }

    switch (requirement.integration) {
      case "calendar": {
        const accounts = settings.integrations.google?.accounts || [];
        const granted_scopes = Array.from(
          new Set<string>(
            accounts.flatMap((account) =>
              (account.scopes || []).map((scope) => String(scope)),
            ),
          ),
        );
        return {
          integration: "calendar",
          configured: Boolean(settings.integrations.google?.enabled && accounts.length),
          owner_bound: false,
          adapter_available: false,
          granted_scopes,
          detail:
            "Google account settings may be present, but the current schema does not prove a ZCOS owner binding or an executive calendar adapter.",
        };
      }
      case "email": {
        const email = settings.integrations.email;
        const google = settings.integrations.google;
        const googleScopes = (google?.accounts || []).flatMap(
          (account) => (account.scopes || []).map((scope) => String(scope)),
        );
        const configured = Boolean(
          (email?.enabled && (email.accounts || []).length) ||
          (google?.enabled && (google.accounts || []).length),
        );
        return {
          integration: "email",
          configured,
          owner_bound: false,
          adapter_available: false,
          granted_scopes: Array.from(new Set(googleScopes)),
          detail:
            "Email account settings may be present, but the current schema does not prove a ZCOS owner binding or a governed executive email adapter.",
        };
      }
      case "messaging":
        return {
          integration: "messaging",
          configured: Boolean(settings.integrations.telephony?.enabled),
          owner_bound: false,
          adapter_available: false,
          granted_scopes: [],
          detail:
            "Messaging settings are not yet bound to a verified ZCOS owner or governed ZENO Unite adapter.",
        };
      case "crm":
        return {
          integration: "crm",
          configured: Boolean(
            settings.integrations.crm?.enabled &&
            (settings.integrations.crm.accounts || []).length,
          ),
          owner_bound: false,
          adapter_available: false,
          granted_scopes: [],
          detail:
            "CRM settings are not yet bound to a verified ZCOS owner or governed executive-operations adapter.",
        };
      case "projects":
        return {
          integration: "projects",
          configured: true,
          owner_bound: true,
          adapter_available: false,
          granted_scopes: ["projects.read", "tasks.write"],
          detail:
            "ZCOS Project context is available only through a registered typed capability adapter.",
        };
    }
  }
}

export default SettingsExecutiveIntegrationResolver;
