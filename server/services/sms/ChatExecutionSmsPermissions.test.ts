import { describe, expect, it, vi } from "vitest";

import { ChatExecutionService } from "../ChatExecutionService";

describe("SMS channel permissions", () => {
  it("does not invoke memory, knowledge, projects, files, or reflection when disabled", async () => {
    const injectedMemory = vi.fn(async () => ({ formatted: "private memory" }));
    const knowledgeContext = vi.fn(async () => ({ prompt: "private knowledge" }));
    const adminContext = vi.fn(async () => ({ text: "private project", meta: { projectInstructions: true, projectSourceCount: 1 } }));
    const fileContext = vi.fn(async () => ({ prompt: "private file", filesReferenced: ["private.pdf"], failedFiles: [], imageBlocks: [] }));
    const reflect = vi.fn(async () => undefined);
    const result = await ChatExecutionService.execute({
      userId: "user-owner",
      message: "Hello",
      route: "sms",
      persistUserMessage: false,
      context: { channelPermissions: { memory: false, knowledge: false, projects: false } },
    }, {
      injectedMemory,
      knowledgeContext,
      adminContext,
      fileContext,
      contextAssessment: vi.fn(async () => ({ assessment: { responsePolicy: "proceed", materialUncertainty: false, questions: [] } })),
      voicePrompt: vi.fn(async () => ""),
      route: vi.fn(async () => ({ reply: "Hello from ZAR", agent: "ManagerAgent", metadata: {} })),
      present: vi.fn(async (draft) => ({ content: draft, adjustments: [] })),
      reflect,
      log: vi.fn(async () => undefined),
    });
    expect(result.reply).toBe("Hello from ZAR");
    expect(injectedMemory).not.toHaveBeenCalled();
    expect(knowledgeContext).not.toHaveBeenCalled();
    expect(adminContext).not.toHaveBeenCalled();
    expect(fileContext).not.toHaveBeenCalled();
    expect(reflect).not.toHaveBeenCalled();
  });
});
