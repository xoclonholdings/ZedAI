/**
 * Admin-settings public entry. The shapes and defaults live under
 * ./admin-settings/:
 *
 *   types.ts     all interfaces (AppSettings, AuthSettings,
 *                ManagedUser, AgentDefinition, every Integration*
 *                shape, AdminSettings composite)
 *   defaults.ts  default values used at first-run and reset
 *
 * Consumers should keep importing from "@shared/adminSettings" (or
 * the relative equivalent) — this file is a barrel that re-exports
 * the public surface unchanged.
 */

export * from "./admin-settings/types";
export * from "./admin-settings/defaults";
