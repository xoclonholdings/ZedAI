export type ConversationMode = "chat" | "agent";
export type AgentTarget = "operations" | "research" | "business" | "finance";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  preview?: string | null;
  mode: ConversationMode;
  model?: string;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, any> | null;
  createdAt: string | Date;
}

export interface File {
  id: string;
  conversationId: string;
  fileName: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  status?: string;
  extractedContent?: string | null;
  analysis?: string | null;
  createdAt?: string | Date;
}

export interface Session {
  id: string;
  conversationId: string;
  userId?: string;
  startedAt?: string | Date;
  endedAt?: string | Date | null;
  duration?: number;
  memoryUsage?: number;
  metadata?: Record<string, any> | null;
}
