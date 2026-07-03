import fs from "fs/promises";
import path from "path";

import { createManagedUser, loadAdminSettings } from "../services/AdminSettingsStore";
import { fetchWebTargetsFromText } from "../services/WebContentService";
import { HUB_CONFIG_DIR } from "../utils/repoPaths";

const SETTINGS_PATH = path.join(HUB_CONFIG_DIR, "admin-settings.json");

type CheckResult = {
  name: string;
  status: "PASS" | "PARTIAL" | "FAIL" | "SKIP";
  detail: string;
  metadata?: Record<string, unknown>;
};

type CookieJar = {
  header(): string;
  store(headers: Headers): void;
};

function makeCookieJar(): CookieJar {
  const cookies = new Map<string, string>();
  return {
    header() {
      return Array.from(cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    },
    store(headers: Headers) {
      for (const value of headers.getSetCookie?.() || []) {
        const [pair] = value.split(";");
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      const fallback = headers.get("set-cookie");
      if (fallback) {
        const [pair] = fallback.split(";");
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    },
  };
}

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function configSnapshot(settings: Awaited<ReturnType<typeof loadAdminSettings>>) {
  const email = settings.integrations.email;
  const accounts = settings.integrations.email.accounts || [];
  const completeAccountCount = accounts.filter(
    (account) =>
      account.smtpHost &&
      account.smtpPort &&
      account.username &&
      account.password &&
      account.fromAddress,
  ).length;
  const smtpEnvComplete =
    (envPresent("EMAIL_SMTP_HOST") &&
      envPresent("EMAIL_SMTP_PORT") &&
      envPresent("EMAIL_SMTP_USER") &&
      envPresent("EMAIL_SMTP_PASSWORD") &&
      envPresent("EMAIL_FROM_ADDRESS")) ||
    (envPresent("SMTP_HOST") &&
      envPresent("SMTP_PORT") &&
      envPresent("SMTP_USER") &&
      envPresent("SMTP_PASSWORD") &&
      envPresent("SMTP_FROM"));

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    emailProviderEnabledEnv: process.env.EMAIL_PROVIDER_ENABLED === "true",
    smtpEnvComplete,
    adminEmailEnabled: Boolean(email.enabled),
    adminEmailComplete: Boolean(
      email.smtpHost && email.smtpPort && email.username && email.password && email.fromAddress,
    ),
    emailAccountCount: accounts.length,
    completeEmailAccountCount: completeAccountCount,
    userCount: settings.users.length,
    adminUserCount: settings.users.filter((user) => user.isAdmin).length,
    providerEnv: {
      openai: envPresent("OPENAI_API_KEY"),
      anthropic: envPresent("ANTHROPIC_API_KEY"),
      groq: envPresent("GROQ_API_KEY"),
      openrouter: envPresent("OPENROUTER_API_KEY"),
      brave: envPresent("BRAVE_SEARCH_API_KEY"),
      serper: envPresent("SERPER_API_KEY"),
    },
  };
}

async function verifyExternalWebFetch(): Promise<CheckResult> {
  try {
    const response = await fetchWebTargetsFromText(
      "What is a direct quote from the blog page of https://zwap.online?",
      1,
    );
    const homepage = response.pages.find((page) => new URL(page.url).hostname.includes("zwap.online"));
    const discoveredBlog = response.targets.find((target) => /\/blog\/?$/i.test(new URL(target.url).pathname));
    const blogPage = response.pages.find((page) => /\/blog\/?$/i.test(new URL(page.url).pathname));

    if (homepage && blogPage) {
      return {
        name: "external_web_fetch_zwap_blog",
        status: "PASS",
        detail: "WebContentService fetched zwap.online and discovered/fetched the blog page.",
        metadata: {
          targetCount: response.targets.length,
          pageCount: response.pages.length,
          homepageStatus: homepage.status,
          blogStatus: blogPage.status,
          blogUrl: blogPage.url,
        },
      };
    }

    if (homepage && discoveredBlog) {
      return {
        name: "external_web_fetch_zwap_blog",
        status: "PARTIAL",
        detail: "Homepage fetched and blog candidate discovered, but the blog page was not readable.",
        metadata: {
          targetCount: response.targets.length,
          pageCount: response.pages.length,
          homepageStatus: homepage.status,
          discoveredBlogUrl: discoveredBlog.url,
          errors: response.errors,
        },
      };
    }

    return {
      name: "external_web_fetch_zwap_blog",
      status: "PARTIAL",
      detail: "External fetch ran, but zwap.online homepage/blog content was not both readable.",
      metadata: {
        targetCount: response.targets.length,
        pageCount: response.pages.length,
        errors: response.errors,
        pages: response.pages.map((page) => ({ url: page.url, status: page.status, title: page.title })),
      },
    };
  } catch (error: any) {
    return {
      name: "external_web_fetch_zwap_blog",
      status: "FAIL",
      detail: error?.message || String(error),
    };
  }
}

async function requestJson(
  baseUrl: string,
  pathName: string,
  options: RequestInit = {},
  jar?: CookieJar,
) {
  const headers = new Headers(options.headers || {});
  if (jar?.header()) headers.set("cookie", jar.header());
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers,
    redirect: "manual",
  });
  jar?.store(response.headers);
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function verifyLiveHttp(baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const settingsRaw = await fs.readFile(SETTINGS_PATH, "utf8").catch(() => "");
  const settings = await loadAdminSettings();

  const anonymous = await requestJson(normalizedBase, "/api/admin/settings");
  results.push({
    name: "http_anonymous_admin_denied",
    status: anonymous.response.status === 401 ? "PASS" : "FAIL",
    detail: `GET /api/admin/settings returned HTTP ${anonymous.response.status}.`,
  });

  const adminJar = makeCookieJar();
  const adminLogin = await requestJson(
    normalizedBase,
    "/api/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase: settings.auth.securePhrase }),
    },
    adminJar,
  );
  const adminSettings = await requestJson(normalizedBase, "/api/admin/settings", {}, adminJar);
  results.push({
    name: "http_admin_allowed",
    status: adminLogin.response.ok && adminSettings.response.status === 200 ? "PASS" : "FAIL",
    detail: `admin login HTTP ${adminLogin.response.status}; settings HTTP ${adminSettings.response.status}.`,
  });

  try {
    const normalPassword = `LiveVerify-${Date.now()}!`;
    await createManagedUser({
      username: `live_verify_${Date.now()}`,
      password: normalPassword,
      email: "live-verify@zed-ai.test",
      firstName: "Live",
      lastName: "Verify",
    });
    const updated = await loadAdminSettings();
    const tempUser = [...updated.users].reverse().find((user) => user.email === "live-verify@zed-ai.test");
    const normalJar = makeCookieJar();
    const normalLogin = await requestJson(
      normalizedBase,
      "/api/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: tempUser?.username, password: normalPassword }),
      },
      normalJar,
    );
    const normalSettings = await requestJson(normalizedBase, "/api/admin/settings", {}, normalJar);
    results.push({
      name: "http_normal_user_admin_denied",
      status: normalLogin.response.ok && normalSettings.response.status === 403 ? "PASS" : "FAIL",
      detail: `normal login HTTP ${normalLogin.response.status}; settings HTTP ${normalSettings.response.status}.`,
    });

    const chat = await requestJson(
      normalizedBase,
      "/api/orchestrate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Visit https://zwap.online and tell me what you see.",
          conversationId: undefined,
        }),
      },
      normalJar,
    );
    const trace = chat.body?.metadata?.executionTrace || chat.body?.trace;
    const tracePresent = Boolean(trace?.traceId && trace?.route === "/api/orchestrate");
    results.push({
      name: "http_orchestrate_trace",
      status: tracePresent ? "PASS" : "FAIL",
      detail: `POST /api/orchestrate returned HTTP ${chat.response.status}.`,
      metadata: trace
        ? {
            traceId: trace.traceId,
            route: trace.route,
            selectedAgent: trace.selectedAgent,
            detectedIntent: trace.detectedIntent,
            executionStatus: trace.executionStatus,
            failureReason: trace.failureReason,
            servicesInvoked: trace.servicesInvoked,
            externalCalls: trace.externalCalls,
          }
        : {
            bodyKeys: chat.body && typeof chat.body === "object" ? Object.keys(chat.body) : [],
            error: chat.body?.error,
            replyPreview: typeof chat.body?.reply === "string" ? chat.body.reply.slice(0, 240) : undefined,
            agent: chat.body?.agent,
            contentType: chat.response.headers.get("content-type"),
          },
    });
    if (tracePresent) {
      results.push({
        name: "http_orchestrate_runtime_result",
        status: trace.executionStatus === "success" ? "PASS" : "PARTIAL",
        detail:
          trace.executionStatus === "success"
            ? "Chat request completed successfully."
            : `Chat route traced correctly but execution ended ${trace.executionStatus}: ${trace.failureReason || "unknown"}.`,
        metadata: {
          selectedAgent: trace.selectedAgent,
          detectedIntent: trace.detectedIntent,
          executionStatus: trace.executionStatus,
          failureReason: trace.failureReason,
          providerUsed: trace.providerUsed,
          providerTarget: trace.providerTarget,
        },
      });
    }
  } finally {
    if (settingsRaw) {
      await fs.writeFile(SETTINGS_PATH, settingsRaw, "utf8");
    }
  }

  return results;
}

async function main() {
  const settings = await loadAdminSettings();
  const results: CheckResult[] = [
    {
      name: "runtime_config_snapshot",
      status: "PASS",
      detail: "Loaded runtime admin settings and environment presence without printing secrets.",
      metadata: configSnapshot(settings),
    },
    await verifyExternalWebFetch(),
  ];

  const baseUrl = process.env.LIVE_ZED_BASE_URL?.trim();
  if (baseUrl) {
    results.push(...await verifyLiveHttp(baseUrl));
  } else {
    results.push({
      name: "live_http_checks",
      status: "SKIP",
      detail: "Set LIVE_ZED_BASE_URL to run live server auth and chat trace checks.",
    });
  }

  const failed = results.filter((result) => result.status === "FAIL");
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
