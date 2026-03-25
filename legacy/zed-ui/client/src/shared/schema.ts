// Shared types for the ZED application

export interface Conversation {
  id: string;
  title?: string;
  preview?: string;
  mode?: 'chat' | 'agent';
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{
    name: string;
    size: number;
    mimeType: string;
  }>;
  createdAt: string | Date;
}

export interface File {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
}

export type ConversationMode = 'chat' | 'agent';