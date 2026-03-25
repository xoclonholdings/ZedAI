// Shared type definitions for ZED AI

export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'ai';
  timestamp: string;
  conversationId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface File {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  path: string;
}

export type ConversationMode = 'chat' | 'analysis' | 'document';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}