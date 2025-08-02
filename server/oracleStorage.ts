import { prisma } from './prisma';
import { User, Conversation, Message, File as DBFile, UpsertUser, InsertConversation, InsertMessage, InsertFile, ConversationMode } from '@shared/schema';
// Import Prisma types for type safety
import { Prisma } from '@prisma/client';

export class PostgreSQLStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    // 'id' is the correct unique field for User
    const user = await prisma.user.findUnique({
      where: { id }
    });
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // 'email' is assumed to be unique for User
    const user = await prisma.user.findUnique({
      where: { email: username }
    });
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Only use valid fields for User model
    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(), // If your schema uses 'updatedAt', otherwise use the correct field
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
    // Use correct field for user reference in Conversation
    const conversations = await prisma.conversation.findMany({
      where: { userId: userId }, // If your schema uses 'userId', otherwise use the correct field
      orderBy: { updatedAt: 'desc' }, // If your schema uses 'updatedAt'
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
        userId: data.userId, // If your schema uses 'userId'
      },
    });
    return conversation as Conversation;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        ...data
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
      where: { conversationId: conversationId }, // If your schema uses 'conversationId'
      orderBy: { createdAt: 'asc' }, // If your schema uses 'createdAt'
    });
    return messages as Message[];
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const message = await prisma.message.create({
      data: {
        content: data.content,
        role: data.role,
        conversationId: data.conversationId, // If your schema uses 'conversationId'
      },
    });
    return message as Message;
  }

  // File operations
  async getFiles(conversationId: string): Promise<DBFile[]> {
    const files = await prisma.file.findMany({
      where: { conversationId: conversationId }, // If your schema uses 'conversationId'
      orderBy: { createdAt: 'desc' }, // Use the correct field name from your schema
    });
    return files as DBFile[];
  }

  async createFile(data: InsertFile): Promise<DBFile> {
    const file = await prisma.file.create({
      data: {
        fileName: data.fileName, // If your schema uses 'fileName'
        originalName: data.originalName, // If your schema uses 'originalName'
        size: data.size,
        mimeType: data.mimeType, // If your schema uses 'mimeType'
        status: data.status,
        extractedContent: data.extractedContent, // If your schema uses 'extractedContent'
        analysis: data.analysis === null ? undefined : data.analysis,
        conversationId: data.conversationId, // If your schema uses 'conversationId'
      },
    });
    return file as DBFile;
  }

  async updateFile(id: string, data: Partial<DBFile>): Promise<DBFile> {
    // Exclude 'conversationId' from update data
    const { conversationId, ...updateData } = data;
    const file = await prisma.file.update({
      where: { id },
      data: {
        ...updateData,
        analysis: updateData.analysis as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
      },
    });
    return file as DBFile;
  }

  // Memory operations
  async getCoreMemory(key: string): Promise<any> {
    const memory = await prisma.coreMemory.findUnique({
      where: { key },
    });
    return memory ? JSON.parse(memory.value) : undefined; // Use 'value' if that's your schema field
  }

  async setCoreMemory(key: string, content: any, updatedBy: string): Promise<void> {
    await prisma.coreMemory.upsert({
      where: { key },
      update: {
        value: JSON.stringify(content), // Use 'value' if that's your schema field
        updated_at: new Date(), // Use 'updated_at' if that's your schema field
      },
      create: {
        key,
        value: JSON.stringify(content),
      },
    });
  }

  async getProjectMemory(userId: string, key: string): Promise<any> {
    // Composite key must match your schema, e.g. { userId, key }
    const memory = await prisma.projectMemory.findUnique({
      where: { user_id_key: { user_id: userId, key: key } }, // Use the actual composite unique field name from your schema.prisma
    });
    return memory ? JSON.parse(memory.content) : undefined;
  }

  async setProjectMemory(userId: string, key: string, content: any): Promise<void> {
    await prisma.projectMemory.upsert({
      where: { user_id_key: { user_id: userId, key: key } }, // Use the actual composite unique field name from your schema.prisma
      update: {
        content: JSON.stringify(content),
        updated_at: new Date(),
      },
      create: {
        user_id: userId, // Use the actual field name from your Prisma schema
        key: key, // Use the actual field name from your Prisma schema
        value: JSON.stringify(content),
      },
    });
  }

  async getScratchpadMemory(userId: string): Promise<any[]> {
    const memories = await prisma.scratchpadMemory.findMany({
      where: {
        user_id: userId, // Use 'user_id' as per your schema
        expires_at: { gt: new Date() }, // If your schema uses 'expires_at'
      },
      orderBy: { expires_at: 'desc' }, // Use the correct field name from your schema
    });
    // Use 'content' if that's your schema field
    return memories.map((m: { content: string }) => JSON.parse(m.content));
  }

  async addScratchpadMemory(userId: string, content: any): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    await prisma.scratchpadMemory.create({
      data: {
        user_id: userId, // Use 'user_id' as per your schema
        content: JSON.stringify(content), // Use 'content' if that's your schema field
        expires_at: expiresAt, // Use 'expires_at' as per your schema
      },
    });
  }

  async cleanupExpiredMemory(): Promise<void> {
    await prisma.scratchpadMemory.deleteMany({
      where: {
        expires_at: { lt: new Date() }, // Use 'expires_at' as per your schema
      },
    });
  }

  // Additional utility methods
  async getUserStats(): Promise<any> {
    const [totalUsers, adminUsers, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count(), // Count all users (replace with a valid filter if you have an admin indicator field)
      prisma.user.count({
        where: {
          conversations: {
            some: {
              updatedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
      orderBy: { createdAt: 'desc' }, // If your schema uses 'createdAt'
    });
    return users as User[];
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(), // If your schema uses 'updatedAt'
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