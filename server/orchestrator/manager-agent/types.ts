export interface HubConfig {
  personality: any;
  security: any;
  parameters: any;
  access: any;
}

export interface OrchestratorRequest {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  ip?: string;
  targetAgent?: "operations" | "research" | "business" | "finance";
}

export interface OrchestratorResponse {
  reply: string;
  agent: string;
  requiresApproval?: boolean;
  pendingApproval?: string;
  blocked?: boolean;
  tier?: number;
  metadata?: Record<string, any>;
}

export type AgentName =
  | "OperationsAgent"
  | "IntelligenceAgent"
  | "BusinessManagerAgent"
  | "FinanceAgent";
