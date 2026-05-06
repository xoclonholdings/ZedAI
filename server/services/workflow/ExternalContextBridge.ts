/**
 * ExternalContextBridge
 *
 * PLACEHOLDER for future CRM / external-tool integrations.
 *
 * Defines clean service boundaries so other modules can already depend
 * on the interface today while real integrations land later. No live
 * provider calls happen here.
 */

export type ExternalProvider =
  | "hubspot"
  | "salesforce"
  | "notion"
  | "airtable"
  | "stripe"
  | "shopify"
  | "custom";

export interface ExternalLookup {
  provider: ExternalProvider;
  entity_type: string;
  query: string;
  user_id: string;
}

export interface ExternalContextResult {
  provider: ExternalProvider;
  entity_type: string;
  query: string;
  records: Array<{ id: string; title: string; snippet: string }>;
  warning: string;
}

export interface ExternalRecordSyncInput {
  provider: ExternalProvider;
  entity_type: string;
  payload: Record<string, unknown>;
  user_id: string;
}

export interface ExternalRecordSyncResult {
  status: "queued" | "stubbed";
  message: string;
  echoed_payload: Record<string, unknown>;
}

export class ExternalContextBridge {
  static async lookup(input: ExternalLookup): Promise<ExternalContextResult> {
    return {
      provider: input.provider,
      entity_type: input.entity_type,
      query: input.query,
      records: [],
      warning:
        "ExternalContextBridge is a placeholder. Wire in a real provider before using results downstream.",
    };
  }

  static async sync(input: ExternalRecordSyncInput): Promise<ExternalRecordSyncResult> {
    return {
      status: "stubbed",
      message:
        "Sync was not performed — ExternalContextBridge is a placeholder. Implement provider client to enable.",
      echoed_payload: input.payload,
    };
  }
}

export default ExternalContextBridge;
