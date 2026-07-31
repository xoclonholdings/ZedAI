import { loadAdminSettings } from "./AdminSettingsStore";

interface GitHubApiUser {
  login?: string;
}

interface GitHubApiRepo {
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  open_issues_count?: number;
}

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  pull_request?: unknown;
  updated_at?: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  updated_at?: string;
}

interface GitHubAccountConfig {
  id?: string;
  label?: string;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  token?: string;
}

export interface GitHubConnectionStatus {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  repoFound: boolean;
  login?: string;
  repoFullName?: string;
  defaultBranch?: string;
  isPrivate?: boolean;
  message: string;
}

export interface GitHubRepoReadout {
  status: GitHubConnectionStatus;
  pulls: Array<{
    number: number;
    title: string;
    url: string;
    state: string;
    draft: boolean;
    updatedAt?: string;
  }>;
  issues: Array<{
    number: number;
    title: string;
    url: string;
    state: string;
    updatedAt?: string;
  }>;
}

async function getGitHubConfig() {
  const settings = await loadAdminSettings();
  const github = settings.integrations.github;
  const account = selectGitHubAccount(github);
  const token = account?.token || github.token || "";
  const baseUrl = github.apiBaseUrl || "https://api.github.com";
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "ZAR-AI-GitHub-Integration",
  };

  return { github, account, baseUrl, headers };
}

function selectGitHubAccount(github: any): GitHubAccountConfig | null {
  const configuredAccount = (github.accounts || []).find(
    (account: GitHubAccountConfig) => account.owner && account.repo && account.token,
  );
  if (configuredAccount) return configuredAccount;

  if (github.owner || github.repo || github.token) {
    return {
      label: github.label || "Primary repo",
      owner: github.owner,
      repo: github.repo,
      defaultBranch: github.defaultBranch,
      token: github.token,
    };
  }

  return null;
}

export async function checkGitHubIntegrationStatus(): Promise<GitHubConnectionStatus> {
  const { github, account, baseUrl, headers } = await getGitHubConfig();

  if (!github.enabled || !account?.owner || !account.repo || !account.token) {
    return {
      configured: false,
      reachable: false,
      authenticated: false,
      repoFound: false,
      message: "GitHub integration is not fully configured yet.",
    };
  }

  try {
    const [userResponse, repoResponse] = await Promise.all([
      fetch(`${baseUrl}/user`, { headers }),
      fetch(`${baseUrl}/repos/${account.owner}/${account.repo}`, { headers }),
    ]);

    if (userResponse.status === 401 || repoResponse.status === 401) {
      return {
        configured: true,
        reachable: true,
        authenticated: false,
        repoFound: false,
        message: "GitHub token was rejected. Update the token in Admin > Integrations.",
      };
    }

    if (!userResponse.ok && !repoResponse.ok) {
      return {
        configured: true,
        reachable: false,
        authenticated: false,
        repoFound: false,
        message: "GitHub API could not be reached with the current settings.",
      };
    }

    const user = userResponse.ok ? ((await userResponse.json()) as GitHubApiUser) : undefined;
    const repo = repoResponse.ok ? ((await repoResponse.json()) as GitHubApiRepo) : undefined;

    return {
      configured: true,
      reachable: true,
      authenticated: !!userResponse.ok,
      repoFound: !!repoResponse.ok,
      login: user?.login,
      repoFullName: repo?.full_name,
      defaultBranch: repo?.default_branch,
      isPrivate: repo?.private,
      message:
        userResponse.ok && repoResponse.ok
          ? "GitHub integration is connected."
          : "GitHub token works, but the target repository was not found with the current owner/repo settings.",
    };
  } catch (error: any) {
    return {
      configured: true,
      reachable: false,
      authenticated: false,
      repoFound: false,
      message: error?.message || "GitHub API request failed.",
    };
  }
}

export async function getGitHubRepoReadout(): Promise<GitHubRepoReadout> {
  const status = await checkGitHubIntegrationStatus();
  if (!status.configured || !status.authenticated || !status.repoFound) {
    return { status, pulls: [], issues: [] };
  }

  const { account, baseUrl, headers } = await getGitHubConfig();
  if (!account?.owner || !account.repo) return { status, pulls: [], issues: [] };

  try {
    const [pullsResponse, issuesResponse] = await Promise.all([
      fetch(`${baseUrl}/repos/${account.owner}/${account.repo}/pulls?state=open&per_page=8`, {
        headers,
      }),
      fetch(`${baseUrl}/repos/${account.owner}/${account.repo}/issues?state=open&per_page=8`, {
        headers,
      }),
    ]);

    const pullsPayload = pullsResponse.ok ? ((await pullsResponse.json()) as GitHubPullRequest[]) : [];
    const issuesPayload = issuesResponse.ok ? ((await issuesResponse.json()) as GitHubIssue[]) : [];

    return {
      status,
      pulls: pullsPayload.map((pull) => ({
        number: pull.number,
        title: pull.title,
        url: pull.html_url,
        state: pull.state,
        draft: !!pull.draft,
        updatedAt: pull.updated_at,
      })),
      issues: issuesPayload
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          updatedAt: issue.updated_at,
        })),
    };
  } catch (error: any) {
    return {
      status: {
        ...status,
        message: error?.message || "GitHub repo readout failed.",
      },
      pulls: [],
      issues: [],
    };
  }
}
