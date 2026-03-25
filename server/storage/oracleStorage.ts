import { prisma } from '../prisma';
import { IStorage } from './storage';
import { 
  User, 
  Conversation, 
  Message, 
  File as DBFile,
  UpsertUser,
  InsertConversation,
  InsertMessage,
  InsertFile,
  ConversationMode
} from '@shared/schema';

export class PostgreSQLStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({
      where: { username }
    });
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      },
      create: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      },
    });
    return user as User;
  }

  async createUser(userData: any): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      },
    });
    return user as User;
  }

  // Conversation operations
  async getConversations(userId: string): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return conversations as Conversation[];
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });
    return conversation as Conversation | undefined;
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const conversation = await prisma.conversation.create({
      data: {
        title: data.title,
        mode: data.mode as any,
        userId: data.userId,
      },
    });
    return conversation as Conversation;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    return conversation as Conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    try {
      await prisma.conversation.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Message operations
  async getMessages(conversationId: string): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return messages as Message[];
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const message = await prisma.message.create({
      data: {
        content: data.content,
        role: data.role,
        conversationId: data.conversationId,
      },
    });
    return message as Message;
  }

  // File operations
  async getFiles(conversationId: string): Promise<DBFile[]> {
    const files = await prisma.file.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
    return files as DBFile[];
  }

  async createFile(data: InsertFile): Promise<DBFile> {
    const file = await prisma.file.create({
      data: {
        fileName: data.fileName,
        originalName: data.originalName,
        size: data.size,
        mimeType: data.mimeType,
        status: data.status,
        extractedContent: data.extractedContent,
        analysis: data.analysis,
        conversationId: data.conversationId,
      },
    });
    return file as DBFile;
  }

  async updateFile(id: string, data: Partial<DBFile>): Promise<DBFile> {
    const file = await prisma.file.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    return file as DBFile;
  }

  // Memory operations
  async getCoreMemory(key: string): Promise<any> {
    const memory = await prisma.coreMemory.findUnique({
      where: { key },
    });
    return memory ? JSON.parse(memory.content) : undefined;
  }

  async setCoreMemory(key: string, content: any, updatedBy: string): Promise<void> {
    await prisma.coreMemory.upsert({
      where: { key },
      update: {
        content: JSON.stringify(content),
        updatedAt: new Date(),
        updatedBy,
      },
      create: {
        key,
        content: JSON.stringify(content),
        updatedBy,
      },
    });
  }

  async getProjectMemory(userId: string, key: string): Promise<any> {
    const memory = await prisma.projectMemory.findUnique({
      where: { userId_key: { userId, key } },
    });
    return memory ? JSON.parse(memory.content) : undefined;
  }

  async setProjectMemory(userId: string, key: string, content: any): Promise<void> {
    await prisma.projectMemory.upsert({
      where: { userId_key: { userId, key } },
      update: {
        content: JSON.stringify(content),
        updatedAt: new Date(),
      },
      create: {
        userId,
        key,
        content: JSON.stringify(content),
      },
    });
  }

  async getScratchpadMemory(userId: string): Promise<any[]> {
    const memories = await prisma.scratchpadMemory.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memories.map((m: any) => JSON.parse(m.content));
  }

  async addScratchpadMemory(userId: string, content: any): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    await prisma.scratchpadMemory.create({
      data: {
        userId,
        content: JSON.stringify(content),
        expiresAt,
      },
    });
  }

  async cleanupExpiredMemory(): Promise<void> {
    await prisma.scratchpadMemory.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  // Additional utility methods
  async getUserStats(): Promise<any> {
    const [totalUsers, adminUsers, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.user.count({
        where: {
          conversations: {
            some: {
              updatedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
              },
            },
          },
        },
      }),
    ]);

    return {
      totalUsers,
      adminUsers,
      activeUsers,
    };
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users as User[];
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    return user as User;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}