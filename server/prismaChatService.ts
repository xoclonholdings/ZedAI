import { prisma } from './prisma';
import { nanoid } from 'nanoid';

// Chat service using Prisma for database operations
export class PrismaChatService {
  
  // Get all conversations for a user
  static async getConversations(userId: string) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  // Get a specific conversation
  static async getConversation(id: string) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
      });
      return conversation;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      return null;
    }
  }

  // Create a new conversation
  static async createConversation(userId: string, title: string, mode: string = 'chat') {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          id: nanoid(),
          userId,
          title,
          mode,
          preview: title.substring(0, 100),
        },
      });
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  // Update a conversation
  static async updateConversation(id: string, updates: any) {
    try {
      const conversation = await prisma.conversation.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });
      return conversation;
    } catch (error) {
      console.error('Error updating conversation:', error);
      return null;
    }
  }

  // Delete a conversation
  static async deleteConversation(id: string) {
    try {
      // First delete associated messages and files
      await prisma.message.deleteMany({
        where: { conversationId: id },
      });
      
      await prisma.file.deleteMany({
        where: { conversationId: id },
      });

      // Then delete the conversation
      await prisma.conversation.delete({
        where: { id },
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }

  // Get messages for a conversation
  static async getMessages(conversationId: string) {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Create a new message
  static async createMessage(conversationId: string, role: string, content: string, metadata?: any) {
    try {
      const message = await prisma.message.create({
        data: {
          id: nanoid(),
          conversationId,
          role,
          content,
          metadata: metadata || null,
        },
      });

      // Update conversation's updatedAt timestamp
      await this.updateConversation(conversationId, {});

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw new Error('Failed to create message');
    }
  }

  // Get files for a conversation
  static async getFiles(conversationId: string) {
    try {
      const files = await prisma.file.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
      return files;
    } catch (error) {
      console.error('Error fetching files:', error);
      return [];
    }
  }

  // Create a new file record
  static async createFile(data: {
    conversationId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    status?: string;
    extractedContent?: string;
    analysis?: any;
  }) {
    try {
      const file = await prisma.file.create({
        data: {
          id: nanoid(),
          conversationId: data.conversationId,
          fileName: data.fileName,
          originalName: data.originalName,
          mimeType: data.mimeType,
          size: data.size,
          status: data.status || 'processing',
          extractedContent: data.extractedContent,
          analysis: data.analysis,
        },
      });
      return file;
    } catch (error) {
      console.error('Error creating file:', error);
      throw new Error('Failed to create file');
    }
  }

  // Update a file record
  static async updateFile(id: string, updates: any) {
    try {
      const file = await prisma.file.update({
        where: { id },
        data: updates,
      });
      return file;
    } catch (error) {
      console.error('Error updating file:', error);
      return null;
    }
  }

  // Get user's chat statistics
  static async getUserStats(userId: string) {
    try {
      const [conversationCount, messageCount, fileCount] = await Promise.all([
        prisma.conversation.count({ where: { userId } }),
        prisma.message.count({
          where: {
            conversation: { userId }
          }
        }),
        prisma.file.count({
          where: {
            conversation: { userId }
          }
        }),
      ]);

      return {
        conversations: conversationCount,
        messages: messageCount,
        files: fileCount,
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return { conversations: 0, messages: 0, files: 0 };
    }
  }
}

export default PrismaChatService;