import { getConnectCategorySummary } from "./admin-settings/connectSummary";
import { IntegrationGapStore } from "./IntegrationGapStore";
import { gatherUserRequestCandidates } from "./UserRequestSignals";

/**
 * Notices when the user has actually asked for something that needs an
 * integration category that isn't connected yet - e.g. asking ZAR to send
 * an email when no email account is configured - and surfaces it as a
 * prompt on Connect: sign up if you don't have the service, or add your
 * credentials if you do. Driven by the same real chat/flow-run text
 * FlowSuggestionEngine reads, not a fabricated "you might like" list.
 */

const RECENCY_WINDOW_MS = 45 * 24 * 60 * 60 * 1000; // 45 days
const MAX_GAPS = 5;

interface GapRule {
  categoryId: string;
  label: string;
  keywords: string[];
  signupUrl?: string;
}

const RULES: GapRule[] = [
  { categoryId: "email", label: "Email", keywords: ["send an email", "send email", "email inbox", "check my email", "check my inbox"], signupUrl: "https://mail.google.com/mail/signup" },
  { categoryId: "google", label: "Gmail / Google", keywords: ["gmail", "google drive", "google calendar"], signupUrl: "https://accounts.google.com/signup" },
  { categoryId: "github", label: "GitHub", keywords: ["github", "pull request", "push to the repo", "open a repo"], signupUrl: "https://github.com/signup" },
  { categoryId: "deployment", label: "Deployment", keywords: ["deploy this", "deploy to netlify", "deploy to vercel", "deploy to render"], signupUrl: "https://app.netlify.com/signup" },
  { categoryId: "payments", label: "Payments", keywords: ["charge a customer", "send an invoice", "stripe", "paypal payment"], signupUrl: "https://dashboard.stripe.com/register" },
  { categoryId: "socialPublishing", label: "Social Media", keywords: ["post on twitter", "post on x", "tweet this", "post on instagram", "post on linkedin", "post on tiktok", "post on facebook"], signupUrl: undefined },
  { categoryId: "crm", label: "CRM", keywords: ["hubspot", "salesforce", "update the crm", "crm pipeline"], signupUrl: "https://www.hubspot.com/products/get-started" },
  { categoryId: "accounting", label: "Accounting", keywords: ["quickbooks", "xero", "bookkeeping"], signupUrl: "https://quickbooks.intuit.com/signup" },
  { categoryId: "cloudStorage", label: "Cloud Storage", keywords: ["upload to dropbox", "upload to drive", "save to onedrive"], signupUrl: "https://www.dropbox.com/register" },
  { categoryId: "marketData", label: "Market Data", keywords: ["market data feed", "stock price api"], signupUrl: "https://polygon.io/pricing" },
  { categoryId: "telephony", label: "Telephony", keywords: ["send a text", "send an sms", "make a phone call", "text message"], signupUrl: "https://www.twilio.com/try-twilio" },
  { categoryId: "businessOperations", label: "Business Operations", keywords: ["shopify", "dropshipping order", "ecommerce order"], signupUrl: "https://www.shopify.com/signup" },
  { categoryId: "gusto", label: "Payroll", keywords: ["run payroll", "gusto"], signupUrl: "https://gusto.com/get-started" },
];

export interface IntegrationGap {
  id: string;
  categoryId: string;
  label: string;
  matchedText: string;
  signupUrl?: string;
  occurrences: number;
  lastSeenAt: string;
}

export async function computeIntegrationGaps(userId: string): Promise<IntegrationGap[]> {
  const [candidates, categories, dismissed] = await Promise.all([
    gatherUserRequestCandidates(userId),
    getConnectCategorySummary(),
    IntegrationGapStore.getDismissed(userId),
  ]);

  const connectedIds = new Set(categories.filter((category) => category.connected).map((category) => category.id));
  const now = Date.now();
  const gaps: IntegrationGap[] = [];

  for (const rule of RULES) {
    if (connectedIds.has(rule.categoryId) || dismissed.has(rule.categoryId)) continue;

    const matches = candidates.filter((candidate) => {
      if (now - candidate.at > RECENCY_WINDOW_MS) return false;
      const lower = candidate.text.toLowerCase();
      return rule.keywords.some((keyword) => lower.includes(keyword));
    });
    if (matches.length === 0) continue;

    matches.sort((a, b) => b.at - a.at);
    gaps.push({
      id: rule.categoryId,
      categoryId: rule.categoryId,
      label: rule.label,
      matchedText: matches[0].text,
      signupUrl: rule.signupUrl,
      occurrences: matches.length,
      lastSeenAt: new Date(matches[0].at).toISOString(),
    });
  }

  return gaps.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_GAPS);
}

export async function dismissIntegrationGap(userId: string, gapId: string): Promise<void> {
  await IntegrationGapStore.dismiss(userId, gapId);
}
