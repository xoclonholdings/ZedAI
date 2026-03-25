
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import type {
  User,
  UpsertUser,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  File as DBFile,
  InsertFile,
  Session,
  InsertSession,
  CoreMemory,
  InsertCoreMemory,
  ProjectMemory,
  InsertProjectMemory,
  ScratchpadMemory,
  InsertScratchpadMemory,
} from "@shared/schema";

interface OfflineData {
  users: Record<string, User>;
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  files: Record<string, DBFile[]>;
  sessions: Record<string, Session>;
  coreMemory: Record<string, CoreMemory>;
  projectMemory: Record<string, ProjectMemory[]>;
  scratchpadMemory: Record<string, ScratchpadMemory[]>;
}

export class OfflineStorage {
  private dataFile = path.join(process.cwd(), 'offline-data.json');
  private data: OfflineData = {
    users: {},
    conversations: {},
    messages: {},
    files: {},
    sessions: {},
    coreMemory: {},
    projectMemory: {},
    scratchpadMemory: {}
  };

  async initialize(): Promise<void> {
    try {
      const fileExists = await fs.access(this.dataFile).then(() => true).catch(() => false);
      if (fileExists) {
        const content = await fs.readFile(this.dataFile, 'utf-8');
        this.data = JSON.parse(content);
        console.log('[OFFLINE_STORAGE] Loaded existing offline data');
      } else {
        await this.createDefaultData();
        console.log('[OFFLINE_STORAGE] Created new offline data store');
      }
    } catch (error) {
      console.error('[OFFLINE_STORAGE] Failed to initialize:', error);
      await this.createDefaultData();
    }
  }

  private async createDefaultData(): Promise<void> {
    // Create default admin user
    const adminUser: User = {
      id: 'admin_user',
      username: 'Admin',
      password: 'admin123',
      email: 'admin@zed.local',
      firstName: 'System',
      lastName: 'Administrator',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.data.users['admin_user'] = adminUser;
    await this.save();
  }

  private async save(): Promise<void> {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('[OFFLINE_STORAGE] Failed to save data:', error);
    }
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.data.users[id];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Object.values(this.data.users).find(user => user.username === username);
  }

  async getAllUsers(): Promise<User[]> {
    return Object.values(this.data.users);
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      ...userData,
      id: userData.id || this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    this.data.users[user.id] = user;
    await this.save();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.data.users[id];
    if (!user) return undefined;

    this.data.users[id] = { ...user, ...updates, updatedAt: new Date() };
    await this.save();
    return this.data.users[id];
  }

  async deleteUser(id: string): Promise<boolean> {
    if (this.data.users[id]) {
      delete this.data.users[id];
      await this.save();
      return true;
    }
    return false;
  }

  // Conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.data.conversations[id];
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return Object.values(this.data.conversations).filter(conv => conv.userId === userId);
  }

  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const conversation: Conversation = {
      ...conversationData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.data.conversations[conversation.id] = conversation;
    this.data.messages[conversation.id] = [];
    this.data.files[conversation.id] = [];
    await this.save();
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.data.conversations[id];
    if (!conversation) return undefined;

    this.data.conversations[id] = { ...conversation, ...updates, updatedAt: new Date() };
    await this.save();
    return this.data.conversations[id];
  }

  async deleteConversation(id: string): Promise<boolean> {
    if (this.data.conversations[id]) {
      delete this.data.conversations[id];
      delete this.data.messages[id];
      delete this.data.files[id];
      await this.save();
      return true;
    }
    return false;
  }

  // Message operations
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return this.data.messages[conversationId] || [];
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const message: Message = {
      ...messageData,
      id: this.generateId(),
      createdAt: new Date()
    };

    if (!this.data.messages[messageData.conversationId]) {
      this.data.messages[messageData.conversationId] = [];
    }

    this.data.messages[messageData.conversationId].push(message);
    await this.save();
    return message;
  }

  // File operations
  async getFilesByConversation(conversationId: string): Promise<DBFile[]> {
    return this.data.files[conversationId] || [];
  }

  async createFile(fileData: InsertFile): Promise<DBFile> {
    const file: DBFile = {
      ...fileData,
      id: this.generateId(),
      createdAt: new Date()
    };

    if (!this.data.files[fileData.conversationId]) {
      this.data.files[fileData.conversationId] = [];
    }

    this.data.files[fileData.conversationId].push(file);
    await this.save();
    return file;
  }

  // Session operations
  async createSession(sessionData: InsertSession): Promise<Session> {
    const session: Session = {
      ...sessionData,
      id: this.generateId()
    };
    this.data.sessions[session.conversationId] = session;
    await this.save();
    return session;
  }

  async getSession(conversationId: string): Promise<Session | undefined> {
    return this.data.sessions[conversationId];
  }

  // Memory operations
  async getAllCoreMemory(): Promise<CoreMemory[]> {
    return Object.values(this.data.coreMemory);
  }

  async setCoreMemory(memoryData: InsertCoreMemory): Promise<CoreMemory> {
    const memory: CoreMemory = {
      ...memoryData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.data.coreMemory[memory.key] = memory;
    await this.save();
    return memory;
  }

  async getProjectMemory(userId: string): Promise<ProjectMemory[]> {
    return this.data.projectMemory[userId] || [];
  }

  async createProjectMemory(memoryData: InsertProjectMemory): Promise<ProjectMemory> {
    const memory: ProjectMemory = {
      ...memoryData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.data.projectMemory[memoryData.userId]) {
      this.data.projectMemory[memoryData.userId] = [];
    }

    this.data.projectMemory[memoryData.userId].push(memory);
    await this.save();
    return memory;
  }

  async updateProjectMemory(id: string, updates: Partial<ProjectMemory>): Promise<ProjectMemory | undefined> {
    for (const userId in this.data.projectMemory) {
      const memories = this.data.projectMemory[userId];
      const index = memories.findIndex(m => m.id === id);
      if (index !== -1) {
        memories[index] = { ...memories[index], ...updates, updatedAt: new Date() };
        await this.save();
        return memories[index];
      }
    }
    return undefined;
  }

  async deleteProjectMemory(id: string): Promise<boolean> {
    for (const userId in this.data.projectMemory) {
      const memories = this.data.projectMemory[userId];
      const index = memories.findIndex(m => m.id === id);
      if (index !== -1) {
        memories.splice(index, 1);
        await this.save();
        return true;
      }
    }
    return false;
  }

  async getScratchpadMemory(userId: string): Promise<ScratchpadMemory[]> {
    return this.data.scratchpadMemory[userId] || [];
  }

  async createScratchpadMemory(memoryData: InsertScratchpadMemory): Promise<ScratchpadMemory> {
    const memory: ScratchpadMemory = {
      ...memoryData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this.data.scratchpadMemory[memoryData.userId]) {
      this.data.scratchpadMemory[memoryData.userId] = [];
    }

    this.data.scratchpadMemory[memoryData.userId].push(memory);
    await this.save();
    return memory;
  }

  // Search and utility methods
  async searchConversations(userId: string, query: string): Promise<Conversation[]> {
    const userConversations = await this.getConversationsByUser(userId);
    return userConversations.filter(conv => 
      conv.title?.toLowerCase().includes(query.toLowerCase()) ||
      conv.preview?.toLowerCase().includes(query.toLowerCase())
    );
  }

  async getRecentActivity(userId: string, limit: number = 10): Promise<any[]> {
    const conversations = await this.getConversationsByUser(userId);
    return conversations
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, limit)
      .map(conv => ({
        type: 'conversation',
        id: conv.id,
        title: conv.title,
        timestamp: conv.updatedAt || conv.createdAt
      }));
  }

  getCacheStats(): any {
    return {
      offline_mode: true,
      users_count: Object.keys(this.data.users).length,
      conversations_count: Object.keys(this.data.conversations).length,
      total_messages: Object.values(this.data.messages).reduce((sum, msgs) => sum + msgs.length, 0),
      timestamp: new Date().toISOString()
    };
  }

  async cleanupExpiredData(): Promise<void> {
    // In offline mode, we can implement simple cleanup logic
    console.log('[OFFLINE_STORAGE] Cleanup completed (offline mode)');
  }

  async optimizeStorage(): Promise<void> {
    // Rewrite the file to optimize storage
    await this.save();
    console.log('[OFFLINE_STORAGE] Storage optimized');
  }
}

export const offlineStorage = new OfflineStorage();
