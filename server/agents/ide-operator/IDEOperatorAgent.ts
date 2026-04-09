/**
 * IDE Operator Agent — STUBBED
 * Status: Not yet active. Requires ADMIN approval and sandbox configuration.
 * See SKILL.md for activation checklist.
 */

export interface IDERequest {
  userId: string;
  task: string;
  repository?: string;
  files?: string[];
}

export interface IDEResponse {
  status: "stubbed";
  message: string;
  agent: "IDEOperatorAgent";
}

export class IDEOperatorAgent {
  static readonly STATUS = "STUBBED";

  static async process(_request: IDERequest): Promise<IDEResponse> {
    console.log("[IDEOperatorAgent] Stub called — agent not yet active");
    return {
      status: "stubbed",
      message:
        "The IDE Operator Agent is not yet active. It requires ADMIN approval and sandbox environment configuration. See agents/ide-operator/SKILL.md for the activation checklist.",
      agent: "IDEOperatorAgent",
    };
  }

  static isActive(): boolean {
    return false;
  }
}
