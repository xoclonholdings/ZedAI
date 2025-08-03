// Shared types between frontend and backend

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    role?: 'user' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}

export interface Conversation {
    id: string;
    title: string;
    mode?: ConversationMode;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export type ConversationMode = 'chat' | 'agent';

export interface Message {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: Date | null;
}

export interface File {
    id: string;
    conversationId: string;
    name: string;
    size: number;
    mimeType: string;
    url?: string;
    analysis?: FileAnalysis;
    createdAt: Date;
}

export interface FileAnalysis {
    summary?: string;
    keyPoints?: string[];
    metadata?: Record<string, unknown>;
}

export interface ZedCoreMemory {
    userId: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    authorizedEditors: string[];
    baseTemplate: string;

    personality: {
        baseTraits: Record<string, any>;
        learnedBehaviors: Record<string, any>;
        customizations: Record<string, any>;
    };

    conversations: ZedConversation[];
    uploads: Array<FileUpload>;
    generations: Array<Generation>;
    bookmarks: Array<Bookmark>;
}

export interface ZedConversation {
    id: string;
    title: string;
    messages: Array<{
        role: string;
        content: string;
        timestamp: string;
    }>;
    date: string;
    type: 'conversation';
}

export interface FileUpload {
    id: string;
    filename: string;
    size: number;
    analysis: string;
    date: string;
    type: 'upload';
}

export interface Generation {
    id: string;
    prompt: string;
    response: string;
    date: string;
    type: 'generation';
}

export interface Bookmark {
    id: string;
    title: string;
    content: string;
    tags: string[];
    date: string;
    type: 'bookmark';
}
