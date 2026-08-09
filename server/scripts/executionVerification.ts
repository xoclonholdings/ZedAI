import assert from "assert";
import fs from "fs/promises";
import http from "http";
import path from "path";

import { ChatExecutionService, resolveReferencedWebpageForTest } from "../services/ChatExecutionService";
import { DigitalExecutionService } from "../services/execution/DigitalExecutionService";
import { AgentApprovalAdapter } from "../services/approval/AgentApprovalAdapter";
import { TaskLifecycleManager } from "../services/execution/TaskLifecycleManager";
import { executeAgentStage } from "../services/flow/FlowExecutor";
import { invokeCapital } from "../services/capital/CapitalGateway";
import { fetchWebTargetsFromText } from "../services/WebContentService";
import { selectAgentWithTrace } from "../orchestrator/manager-agent/agent-selection";
import { buildZarAdminContext } from "../services/ZarContextBuilder";
import {
  addProjectSource,
  assignConversationToProject,
  createProject,
  updateProjectInstructions,
} from "../services/ProjectFilingStore";
import { storage } from "../storage/databaseStorage";
import { isAdmin } from "../local-auth/middleware";
import { HUB_CONFIG_DIR, HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";
import type { FlowDefinition, FlowRun, FlowStage } from "../../shared/flow-types";

type Backup = { existed: boolean; content?: string };

async function backupFile(file: string): Promise<Backup> {
  try {
    return { existed: true, content: await fs.readFile(file, "utf8") };
  } catch {
    return { existed: false };
  }
}

async function restoreFile(file: string, backup: Backup): Promise<void> {
  if (backup.existed) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, backup.content || "", "utf8");
    return;
  }
  await fs.rm(file, { force: true }).catch(() => undefined);
}

async function withBackups<T>(files: string[], fn: () => Promise<T>): Promise<T> {
  const backups = new Map<string, Backup>();
  for (const file of files) backups.set(file, await backupFile(file));
  try {
    return await fn();
  } finally {
    for (const file of [...files].reverse()) {
      await restoreFile(file, backups.get(file)!);
    }
  }
}

async function withFixtureServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url === "/blog") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><head><title>Blog</title></head><body><article>Direct quote from the fixture blog page for ZAR verification.</article></body></html>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<html><head><title>Home</title></head><body><a href="/blog">Blog</a><main>Fixture homepage.</main></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function testRouteSelection() {
  process.env.ZED_ROUTER_DISABLE_LLM_CLASSIFIER = "true";
  const config: any = { parameters: {} };
  const research = await selectAgentWithTrace("Visit https://example.com and summarize it", config);
  assert.equal(research.selectedAgent, "IntelligenceAgent");
  assert.equal(research.detectedIntent, "web_research");

  const finance = await selectAgentWithTrace("Log a paper trade: AAPL long entry 190 stop 185 target 200 thesis breakout", config);
  assert.equal(finance.selectedAgent, "FinanceAgent");
  assert.equal(finance.classifierFailed, true);
  assert.equal(finance.fallbackUsed, "keyword");

  const operations = await selectAgentWithTrace("Send an email to test@example.com saying hello", config);
  assert.equal(operations.selectedAgent, "OperationsAgent");

  const business = await selectAgentWithTrace("Review payroll and contractor onboarding", config);
  assert.equal(business.selectedAgent, "BusinessManagerAgent");
}

async function testWebFetchAndPriorReference() {
  const server = await withFixtureServer();
  try {
    const response = await fetchWebTargetsFromText(`What is a direct quote from the blog page of ${server.baseUrl}?`);
    assert(response.pages.some((page) => page.url.endsWith("/blog")), "blog page was not discovered");
    const blog = response.pages.find((page) => page.url.endsWith("/blog"));
    assert(blog?.text.includes("Direct quote from the fixture blog page"));
    assert(blog?.fetchedAt);

    const resolved = resolveReferencedWebpageForTest("What is a quote from the blog page of that website?", [
      {
        role: "assistant",
        metadata: {
          brief: {
            web: {
              pages: [{ url: server.baseUrl }],
            },
          },
        },
      },
    ]);
    assert(resolved.includes(server.baseUrl), "prior website URL was not resolved from metadata");
  } finally {
    await server.close();
  }
}

async function testDigitalProviderDisabled() {
  const old = process.env.EMAIL_PROVIDER_ENABLED;
  delete process.env.EMAIL_PROVIDER_ENABLED;
  try {
    const result = await DigitalExecutionService.execute({
      task_id: "verify-email-disabled",
      user_id: "verify-user",
      approved: true,
      execution_mode: "digital",
      action_type: "email",
      payload: { to: "test@example.com", subject: "Hello", body: "hello" },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureReason, "providerDisabled");
    assert.equal(result.mocked, false);
  } finally {
    if (old === undefined) delete process.env.EMAIL_PROVIDER_ENABLED;
    else process.env.EMAIL_PROVIDER_ENABLED = old;
  }
}

async function withCapitalMock<T>(fn: () => Promise<T>): Promise<T> {
  const oldUrl = process.env.ZILLION_PROSPER_API_URL;
  const oldSecret = process.env.ZILLION_CAPABILITY_SECRET;
  const oldFetch = globalThis.fetch;
  process.env.ZILLION_PROSPER_API_URL = "https://capital.example";
  process.env.ZILLION_CAPABILITY_SECRET = "verification-capability-secret-with-32-characters";
  globalThis.fetch = async (_input, init) => {
    assert.match(String((init?.headers as Record<string, string>)?.Authorization), /^Bearer /);
    return new Response(JSON.stringify({
      agent: "FinanceAgent",
      message: "Delegated to ZILLION Prosper.",
      requiresApproval: false,
      capabilities: ["capital-analysis"],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.ZILLION_PROSPER_API_URL;
    else process.env.ZILLION_PROSPER_API_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.ZILLION_CAPABILITY_SECRET;
    else process.env.ZILLION_CAPABILITY_SECRET = oldSecret;
  }
}

async function testCapitalDelegation() {
  await withCapitalMock(async () => {
    const response = await invokeCapital<any>("verify-user", {
      task: "Review an AAPL paper-trade thesis",
    });
    assert.equal(response.message, "Delegated to ZILLION Prosper.");
  });
}

async function testProjectContext() {
  const projectsFile = path.resolve(HUB_CONFIG_DIR, "projects.json");
  await withBackups([projectsFile], async () => {
    const userId = "verify-user";
    const conversationId = "verify-conversation";
    const project = await createProject(userId, "Verification Project");
    await updateProjectInstructions(userId, project.id, "Always refer to this project as Project Orchid.");
    await addProjectSource(userId, project.id, {
      label: "Project source",
      text: "Project Orchid source material.",
    });
    await assignConversationToProject(userId, conversationId, project.id);
    const context = await buildZarAdminContext({ userId, conversationId, projectId: project.id } as any);
    assert(context.text.includes("Project Orchid"));
    assert.equal(context.meta.projectInstructions, true);
    assert.equal(context.meta.projectSourceCount, 1);
  });
}

async function testChatTraceAndFileContext() {
  const originalCreateMessage = storage.createMessage.bind(storage);
  const originalGetMessages = storage.getMessagesByConversation.bind(storage);
  const originalGetFiles = storage.getFilesByConversation.bind(storage);
  const savedMessages: any[] = [];
  try {
    (storage as any).createMessage = async (data: any) => {
      const message = { ...data, id: `msg-${savedMessages.length + 1}`, createdAt: new Date() };
      savedMessages.push(message);
      return message;
    };
    (storage as any).getMessagesByConversation = async () => [
      {
        role: "assistant",
        metadata: { brief: { web: { pages: [{ url: "https://example.test" }] } } },
      },
    ];
    (storage as any).getFilesByConversation = async () => [
      {
        status: "completed",
        originalName: "orchid.txt",
        fileName: "orchid.txt",
        extractedContent: "UNIQUE_ORCHID_PHRASE",
      },
    ];

    const result = await ChatExecutionService.execute(
      {
        userId: "verify-user",
        message: "What phrase is in the uploaded file?",
        conversationId: "verify-conversation",
        route: "/api/orchestrate",
        projectId: "verify-project",
        workspaceId: "verify-workspace",
        persistUserMessage: true,
      },
      {
        injectedMemory: async () => ({ formatted: "" }),
        contextAssessment: async () => ({ assessment: { responsePolicy: "answer_direct", materialUncertainty: false, questions: [] } }),
        knowledgeContext: async () => ({ prompt: "verification knowledge", retrievalMode: "test" }),
        adminContext: async () => ({ text: "Project Orchid", meta: { projectInstructions: true, projectSourceCount: 1 } }),
        voicePrompt: async () => "voice prompt",
        present: async (draft: string) => ({ content: draft, adjustments: [] }),
        reflect: async () => undefined,
        log: async () => undefined,
        route: async () => ({
          reply: "The uploaded file contains UNIQUE_ORCHID_PHRASE.",
          agent: "OperationsAgent",
          requiresApproval: false,
          metadata: {
            intent: "operations",
            selectedAgent: "OperationsAgent",
            classifierResult: null,
            classifierFailed: false,
            servicesInvoked: ["OperationsAgent.process"],
            toolsInvoked: [],
          },
        }),
      },
    );

    assert.equal(result.trace.route, "/api/orchestrate");
    assert.equal(result.trace.selectedAgent, "OperationsAgent");
    assert.equal(result.metadata.fileContextUsed, true);
    assert.deepEqual(result.metadata.filesReferenced, ["orchid.txt"]);
    assert.equal(result.metadata.projectContextUsed, true);
    assert.equal(result.metadata.workspaceContextUsed, true);
    assert(savedMessages.some((message) => message.role === "assistant" && message.metadata?.executionTrace?.traceId));

    const failed = await ChatExecutionService.execute(
      {
        userId: "verify-user",
        message: "Return empty",
        conversationId: "verify-conversation",
        route: "/api/orchestrate",
        persistUserMessage: true,
      },
      {
        injectedMemory: async () => ({ formatted: "" }),
        contextAssessment: async () => ({ assessment: { responsePolicy: "answer_direct", materialUncertainty: false, questions: [] } }),
        knowledgeContext: async () => ({ prompt: "", retrievalMode: "test" }),
        adminContext: async () => ({ text: "", meta: {} }),
        voicePrompt: async () => "voice prompt",
        present: async (draft: string) => ({ content: draft, adjustments: [] }),
        reflect: async () => undefined,
        log: async () => undefined,
        route: async () => ({ reply: "", agent: "ManagerAgent", metadata: {} }),
      },
    );
    assert.equal(failed.metadata.executionStatus, "failed");
    assert.equal(failed.metadata.failureReason, "upstream_empty_output");
    assert(!savedMessages.some((message) => message.role === "assistant" && !String(message.content || "").trim()));

    const templated = await ChatExecutionService.execute(
      {
        userId: "verify-user",
        message: "Search for my social profiles.",
        conversationId: "verify-conversation",
        route: "/api/orchestrate",
        persistUserMessage: true,
      },
      {
        injectedMemory: async () => ({ formatted: "" }),
        contextAssessment: async () => ({ assessment: { responsePolicy: "answer_direct", materialUncertainty: false, questions: [] } }),
        knowledgeContext: async () => ({ prompt: "", retrievalMode: "test" }),
        adminContext: async () => ({ text: "", meta: {} }),
        voicePrompt: async () => "voice prompt",
        present: async (draft: string) => ({ content: draft, adjustments: [] }),
        reflect: async () => undefined,
        log: async () => undefined,
        route: async () => ({
          reply: "No public profile matched.\n\nNext move: Give me one more constraint or target, and I can turn this into a cleaner action plan.",
          agent: "IntelligenceAgent",
          metadata: {},
        }),
      },
    );
    assert.equal(templated.metadata.executionStatus, "failed");
    assert.equal(templated.metadata.failureReason, "upstream_template_output");
    assert(!String(templated.reply || "").includes("Next move"));
  } finally {
    (storage as any).createMessage = originalCreateMessage;
    (storage as any).getMessagesByConversation = originalGetMessages;
    (storage as any).getFilesByConversation = originalGetFiles;
  }
}

async function testApprovalDispatchPayload() {
  const tasksFile = path.resolve(HUB_SHARED_MEMORY_DIR, "execution/tasks.json");
  await withBackups([tasksFile], async () => {
    const result = await AgentApprovalAdapter.register({
      user_id: "verify-user",
      conversation_id: "verify-conversation",
      message: "Send an email to test@example.com saying hello",
      draft: "Draft email: hello",
      agent: "OperationsAgent",
      dispatch: {
        action_type: "email",
        payload: { to: "test@example.com", subject: "Message from ZAR", body: "hello" },
      },
    });
    const task = await TaskLifecycleManager.get(result.task_id);
    assert(task);
    assert(task!.logs.some((log) => (log.context as any)?.dispatch?.action_type === "email"));
  });
}

async function testFlowFinanceAgentStage() {
  await withCapitalMock(async () => {
    const flow: FlowDefinition = {
      id: "verify-flow",
      slug: "verify-flow",
      name: "Verification Flow",
      category: "finance",
      description: "Verification",
      purpose: "Verification",
      status: "published",
      version: 1,
      agents: ["finance"],
      triggerConditions: ["manual"],
      stages: [],
      userFacingLabel: "Verify",
      userFacingBlurb: "Verify",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stage: FlowStage = {
      id: "verify-stage",
      order: 1,
      name: "Log Paper Trade",
      assignedAgent: "finance",
      requiresApproval: false,
      steps: [],
    };
    const run: FlowRun = {
      id: "verify-run",
      flowId: flow.id,
      flowSlug: flow.slug,
      flowName: flow.name,
      userId: "verify-user",
      status: "running",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progressPct: 0,
      completedStageIds: [],
      pendingStageIds: [stage.id],
      estimatedRemainingWork: "1 stage remaining",
      approvals: [],
      outputs: {},
      errors: [],
      context: {},
      stageRuns: [{ stageId: stage.id, status: "running" }],
    };
    const output = await executeAgentStage({
      run,
      flow,
      stage,
      prompt: "Log a paper trade: AAPL long entry 190 stop 185 target 200 thesis breakout",
    });
    assert.equal(output?.stageExecutionType, "agent");
    assert.equal(output?.agentInvoked, "FinanceAgent");
    assert((output?.servicesInvoked as string[]).includes("CapitalGateway.invokeCapital"));
  });
}

async function testAdminDenial() {
  let statusCode = 0;
  let nextCalled = false;
  const req: any = {
    session: {
      userId: "normal-user",
      user: { username: "normal", isAdmin: false },
      lastActivity: Date.now(),
    },
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(_payload: unknown) {
      return this;
    },
  };
  await isAdmin(req, res, () => {
    nextCalled = true;
  });
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
}

async function main() {
  const tests: Array<[string, () => Promise<void>]> = [
    ["route selection metadata", testRouteSelection],
    ["web URL fetch and prior reference", testWebFetchAndPriorReference],
    ["digital provider disabled failure", testDigitalProviderDisabled],
    ["capital capability delegation", testCapitalDelegation],
    ["project context injection", testProjectContext],
    ["chat trace and file context", testChatTraceAndFileContext],
    ["operation approval dispatch payload", testApprovalDispatchPayload],
    ["flow finance agent stage", testFlowFinanceAgentStage],
    ["admin denial", testAdminDenial],
  ];

  const results: Record<string, "pass"> = {};
  for (const [name, test] of tests) {
    await test();
    results[name] = "pass";
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
