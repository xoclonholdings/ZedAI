import type { ApprovalMode, ApprovalSettings } from "../../shared/adminSettings";
import { defaultApprovalSettings } from "../../shared/adminSettings";

import { loadAdminSettings } from "./AdminSettingsStore";

/**
 * Runtime bridge between user-facing approval settings and the
 * agent-level "should this action be approved / auto / refused?"
 * question.
 *
 * The categorizer maps a raw user message to an
 * ApprovalSettings key using the same keyword vocabulary the old
 * hardcoded OperationsAgent list used, so behaviour is preserved
 * for users who don't change any settings.
 *
 * Kept in server/services/ (not server/middleware/) because it
 * needs to load admin settings on demand, which the middleware
 * layer shouldn't do.
 */

export type ApprovalCategory = keyof ApprovalSettings;

interface CategoryMatcher {
  key: ApprovalCategory;
  patterns: RegExp[];
}

// Order matters — more specific patterns first (e.g. "cancel meeting"
// beats "schedule meeting" when both would fire on "cancel my
// scheduled meeting"). categorize() returns the first hit.
const CATEGORY_MATCHERS: CategoryMatcher[] = [
  {
    key: "sendEmail",
    patterns: [/\bsend\s+(an?\s+)?email\b/i, /\breply\s+by\s+email\b/i, /\bemail\s+\w+\s+about\b/i],
  },
  {
    key: "cancelAppointment",
    patterns: [/\bcancel\s+(the|my)?\s*(meeting|appointment|call)\b/i, /\bcancel\s+.{0,20}\bschedule\b/i],
  },
  {
    key: "scheduleCalendar",
    patterns: [/\bschedule\b/i, /\bcalendar\b/i, /\bbook\s+(a|the)?\s*(meeting|appointment)\b/i, /\bappointment\b/i],
  },
  {
    key: "sendMessage",
    patterns: [/\bsend\s+(a\s+)?(text|sms|message)\b/i, /\btext\s+\w+\s+about\b/i],
  },
  {
    key: "reachOutToContacts",
    patterns: [/\breach\s+out\s+to\b/i, /\bcontact\s+\w+\s+about\b/i, /\bfollow\s+up\s+with\b/i],
  },
  {
    key: "postToSocial",
    patterns: [/\bpost\s+(to|on)\b/i, /\bshare\s+on\s+(twitter|x|linkedin|facebook|instagram|tiktok|threads)\b/i, /\btweet\b/i],
  },
  {
    key: "publishContent",
    patterns: [/\bpublish\b/i, /\bgo\s+live\b/i, /\brelease\s+(the|this)?\s*(article|post|video|episode)\b/i],
  },
  {
    key: "makePayment",
    patterns: [/\bpay\s+\w+\b/i, /\bcharge\s+the\s+card\b/i, /\bsend\s+money\b/i, /\btransfer\s+\$?\d/i],
  },
  {
    key: "sendInvoice",
    patterns: [/\bsend\s+(an?\s+)?invoice\b/i, /\binvoice\s+\w+\b/i],
  },
  {
    key: "deleteData",
    patterns: [/\bdelete\b/i, /\bwipe\b/i, /\bpurge\s+(all|the)?\s*(data|records|history)\b/i, /\bremove\s+(all|every)\b/i],
  },
  {
    key: "updateCredentials",
    patterns: [/\bchange\s+(the|my)?\s*password\b/i, /\brotate\s+.{0,20}\bkey\b/i, /\bupdate\s+.{0,20}\bcredential/i],
  },
  {
    key: "deployCode",
    patterns: [/\bdeploy\b/i, /\bpush\s+to\s+(prod|production)\b/i, /\brelease\s+\w+\s+to\s+prod/i],
  },
  {
    key: "createTask",
    patterns: [/\bcreate\s+(a\s+)?task\b/i, /\bto-?do\b/i, /\badd\s+(a\s+)?task\b/i],
  },
];

/**
 * Categorize a message into one of the ApprovalSettings keys, or
 * null if it doesn't match any known action category. A null
 * category is treated as "general" — no approval gate applied.
 */
export function categorizeApprovalIntent(message: string): ApprovalCategory | null {
  if (!message) return null;
  for (const matcher of CATEGORY_MATCHERS) {
    if (matcher.patterns.some((p) => p.test(message))) return matcher.key;
  }
  return null;
}

/** Human-readable label for a category — used in refusal messages. */
export function approvalCategoryLabel(category: ApprovalCategory): string {
  const map: Record<ApprovalCategory, string> = {
    sendEmail: "Send emails",
    scheduleCalendar: "Schedule calendar items",
    cancelAppointment: "Cancel appointments",
    sendMessage: "Send text messages",
    reachOutToContacts: "Reach out to contacts",
    postToSocial: "Post to social media",
    publishContent: "Publish content",
    makePayment: "Make payments",
    sendInvoice: "Send invoices",
    deleteData: "Delete data",
    updateCredentials: "Update credentials",
    deployCode: "Deploy code",
    createTask: "Create tasks",
  };
  return map[category];
}

interface PolicyDecision {
  mode: ApprovalMode;
  category: ApprovalCategory | null;
  /** If mode === "never", the caller should surface this to the user. */
  refusalReply?: string;
}

/**
 * Look up what the admin wants Zed to do for this message. Returns:
 *   - mode "auto":  no approval gate, dispatch immediately
 *   - mode "ask":   queue for admin approval before dispatch
 *   - mode "never": refuse with a message that points at settings
 *
 * If the message doesn't match any known category, defaults to "auto"
 * (nothing gate-able about the request).
 */
export async function decideApprovalPolicy(message: string): Promise<PolicyDecision> {
  const category = categorizeApprovalIntent(message);
  if (!category) return { mode: "auto", category: null };

  let approvals: ApprovalSettings = defaultApprovalSettings;
  try {
    const settings = await loadAdminSettings();
    if (settings.approvals) approvals = settings.approvals;
  } catch {
    // Fall through with defaults — err on the safe side ("ask" for
    // most categories). See defaultApprovalSettings.
  }

  const mode = approvals[category];
  if (mode === "never") {
    return {
      mode,
      category,
      refusalReply: `Zed isn't allowed to do that — “${approvalCategoryLabel(category)}” is set to Never in your Settings. Change it to Ask or Auto if you want Zed to handle this.`,
    };
  }

  return { mode, category };
}
