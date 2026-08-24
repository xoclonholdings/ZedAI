import { randomUUID } from "crypto";

import {
  ZCOS_INTELLIGENCE_SCHEMA_VERSION,
  type ZcosRequestEnvelope,
} from "../../../shared/zcos-intelligence";
import { createOwnerContext } from "../../services/auth/OwnerContext";
import { detectTaskType } from "../../services/intelligence-core/analysis";

const FRESHNESS = /\b(current|currently|latest|today|tonight|this (?:week|month|year)|news|price|schedule|score|law|regulation|version|release|security advisory|officeholder)\b/i;
const HIGH_STAKES = /\b(medical|diagnosis|medicine|legal|lawsuit|court|bankruptcy|tax|investment|trade|trading|financial|security|privacy|credential|production deletion)\b/i;
const ELEVATED_STAKES = /\b(contract|insurance|employment|housing|credit|deploy|publish|send|delete|transfer|purchase)\b/i;

export interface ZcosRequestInput {
  traceId: string;
  userId: string;
  message: string;
  route: string;
  conversationId?: string;
  projectId?: string;
  workspaceId?: string;
  requestedCapabilityIds?: string[];
  channelPermissions?: { memory?: boolean; knowledge?: boolean; projects?: boolean };
  externalActionsAuthorized?: boolean;
  authenticationSource?: "authenticated_session" | "verified_channel_binding";
}

export class ZcosRequestInterpreter {
  static interpret(input: ZcosRequestInput): ZcosRequestEnvelope {
    const owner = createOwnerContext(input.userId);
    const message = String(input.message || "").trim();
    if (!message) throw new Error("ZCOS request message is required.");
    const stakes = HIGH_STAKES.test(message)
      ? "high"
      : ELEVATED_STAKES.test(message)
        ? "elevated"
        : "ordinary";

    return {
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      requestId: randomUUID(),
      traceId: input.traceId,
      submittedAt: new Date().toISOString(),
      originGalaxy: "ZAR",
      route: input.route,
      owner: {
        ownerUserId: owner.ownerUserId,
        authenticationSource: input.authenticationSource || "authenticated_session",
      },
      intent: {
        kind: detectTaskType(message),
        objective: message,
        explicitFreshness: FRESHNESS.test(message),
        stakes,
      },
      payload: {
        message,
        conversationId: input.conversationId,
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        requestedCapabilityIds: input.requestedCapabilityIds,
      },
      permissions: {
        memory: input.channelPermissions?.memory !== false,
        knowledge: input.channelPermissions?.knowledge !== false,
        projects: input.channelPermissions?.projects !== false,
        externalRetrieval: true,
        externalActions: input.externalActionsAuthorized === true,
      },
    };
  }
}
