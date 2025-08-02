import { zedCoreMemoryService, ZedCoreMemory, ZedMemoryEntry, ZedConversation } from './zedCoreMemory.js';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface CompressionRule {
  name: string;
  description: string;
  condition: (entry: ZedMemoryEntry | ZedConversation) => boolean;
  compress: (entries: (ZedMemoryEntry | ZedConversation)[]) => any;
}

interface CompressionSnapshot {
  id: string;
  userId: string;
  createdAt: Date;
  type: 'scheduled' | 'manual' | 'threshold';
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressedData: {
    conversations: any[];
    memoryEntries: any[];
    insights: string[];
  };
}

class MemoryCompressorService {
  private readonly COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB
  private readonly MAX_CONVERSATION_AGE_DAYS = 90;
  private readonly MAX_MEMORY_ENTRIES = 10000;
  private readonly COMPRESSION_INTERVAL_HOURS = 72;

  private compressionRules: CompressionRule[] = [
    {
      name: 'redundant_responses',
      description: 'Compress repeated assistant responses',
      condition: (entry: any) => 
        entry.type === 'conversation' && 
        entry.messages?.some((m: any) => m.role === 'assistant'),
      compress: (entries: any[]) => this.compressRedundantResponses(entries)
    },
    {
      name: 'old_conversations',
      description: 'Archive conversations older than 90 days',
      condition: (entry: any) => {
        const ageInDays = (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return entry.type === 'conversation' && ageInDays > this.MAX_CONVERSATION_AGE_DAYS;
      },
      compress: (entries: any[]) => this.archiveOldConversations(entries)
    },
    {
      name: 'memory_deduplication',
      description: 'Remove duplicate memory entries',
      condition: (entry: any) => entry.type !== 'conversation',
      compress: (entries: any[]) => this.deduplicateMemoryEntries(entries)
    },
    {
      name: 'conversation_summarization',
      description: 'Summarize long conversation threads',
      condition: (entry: any) => 
        entry.type === 'conversation' && 
        entry.messages?.length > 50,
      compress: (entries: any[]) => this.summarizeConversations(entries)
    }
  ];

  constructor() {
    // Auto-start compression scheduler
    this.schedulePeriodicCompression();
  }

  // MAIN COMPRESSION METHODS
  async compressUserMemory(userId: string, manual: boolean = false): Promise<CompressionSnapshot> {
    const userCore = await zedCoreMemoryService.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const originalSize = JSON.stringify(userCore).length;
    
    // Only compress if size exceeds threshold or manual trigger
    if (!manual && originalSize < this.COMPRESSION_THRESHOLD) {
      throw new Error('Memory size below compression threshold');
    }

    console.log(`Starting compression for user ${userId}, original size: ${originalSize} bytes`);

    // Apply compression rules
    const compressedData = await this.applyCompressionRules(userCore);
    
    // Update user core with compressed data
    userCore.conversations = compressedData.conversations;
    userCore.memoryEntries = compressedData.memoryEntries;

    const compressedSize = JSON.stringify(userCore).length;
    const compressionRatio = (originalSize - compressedSize) / originalSize;

    // Create compression snapshot
    const snapshot: CompressionSnapshot = {
      id: uuidv4(),
      userId,
      createdAt: new Date(),
      type: manual ? 'manual' : 'scheduled',
      originalSize,
      compressedSize,
      compressionRatio,
      compressedData: {
        conversations: compressedData.archivedConversations || [],
        memoryEntries: compressedData.archivedEntries || [],
        insights: compressedData.insights || []
      }
    };

    // Save snapshot
    await this.saveCompressionSnapshot(userId, snapshot);

    // Update compression history in user core
    userCore.compressionHistory.push({
      id: snapshot.id,
      compressedAt: new Date(),
      entriesCompressed: (compressedData.archivedConversations?.length || 0) + 
                       (compressedData.archivedEntries?.length || 0),
      sizeBefore: originalSize,
      sizeAfter: compressedSize,
      method: manual ? 'manual' : 'automatic'
    });

    // Save updated user core
    await zedCoreMemoryService.saveUserCore(userCore);

    console.log(`Compression completed. Saved ${Math.round(compressionRatio * 100)}% space`);
    
    return snapshot;
  }

  private async applyCompressionRules(userCore: ZedCoreMemory): Promise<{
    conversations: ZedConversation[];
    memoryEntries: ZedMemoryEntry[];
    archivedConversations?: any[];
    archivedEntries?: any[];
    insights?: string[];
  }> {
    const result = {
      conversations: [...userCore.conversations],
      memoryEntries: [...userCore.memoryEntries],
      archivedConversations: [] as any[],
      archivedEntries: [] as any[],
      insights: [] as string[]
    };

    // Apply each compression rule
    for (const rule of this.compressionRules) {
      console.log(`Applying compression rule: ${rule.name}`);
      
      if (rule.name === 'old_conversations') {
        const oldConversations = result.conversations.filter(rule.condition);
        const compressed = rule.compress(oldConversations);
        
        result.archivedConversations.push(...compressed.archived);
        result.conversations = result.conversations.filter(c => !oldConversations.includes(c));
        result.insights.push(`Archived ${oldConversations.length} old conversations`);
      }
      
      else if (rule.name === 'redundant_responses') {
        const beforeCount = result.conversations.length;
        result.conversations = rule.compress(result.conversations).compressed;
        const saved = beforeCount - result.conversations.length;
        if (saved > 0) {
          result.insights.push(`Compressed ${saved} redundant conversation responses`);
        }
      }
      
      else if (rule.name === 'memory_deduplication') {
        const beforeCount = result.memoryEntries.length;
        const compressed = rule.compress(result.memoryEntries);
        result.memoryEntries = compressed.compressed;
        result.archivedEntries.push(...(compressed.duplicates || []));
        const saved = beforeCount - result.memoryEntries.length;
        if (saved > 0) {
          result.insights.push(`Removed ${saved} duplicate memory entries`);
        }
      }
      
      else if (rule.name === 'conversation_summarization') {
        const longConversations = result.conversations.filter(rule.condition);
        if (longConversations.length > 0) {
          const compressed = rule.compress(longConversations);
          result.conversations = result.conversations.map(c => 
            longConversations.find(lc => lc.id === c.id) ? 
            compressed.summaries.find((s: any) => s.id === c.id) || c : c
          );
          result.insights.push(`Summarized ${longConversations.length} long conversations`);
        }
      }
    }

    return result;
  }

  // COMPRESSION RULE IMPLEMENTATIONS
  private compressRedundantResponses(conversations: ZedConversation[]): { compressed: ZedConversation[] } {
    const compressed = conversations.map(conversation => {
      if (conversation.messages.length < 5) return conversation;

      const uniqueMessages = [];
      const seenResponses = new Set();

      for (const message of conversation.messages) {
        if (message.role === 'assistant') {
          // Check for similar responses (simplified similarity check)
          const responseKey = message.content.substring(0, 100).toLowerCase();
          if (!seenResponses.has(responseKey)) {
            seenResponses.add(responseKey);
            uniqueMessages.push(message);
          }
        } else {
          uniqueMessages.push(message);
        }
      }

      return {
        ...conversation,
        messages: uniqueMessages,
        updatedAt: new Date()
      };
    });

    return { compressed };
  }

  private archiveOldConversations(conversations: ZedConversation[]): { archived: any[] } {
    const archived = conversations.map(conversation => ({
      id: conversation.id,
      title: conversation.title,
      route: conversation.route,
      messageCount: conversation.messages.length,
      createdAt: conversation.createdAt,
      lastMessage: conversation.messages[conversation.messages.length - 1]?.content.substring(0, 200),
      archivedAt: new Date(),
      summary: this.generateConversationSummary(conversation)
    }));

    return { archived };
  }

  private deduplicateMemoryEntries(entries: ZedMemoryEntry[]): { 
    compressed: ZedMemoryEntry[];
    duplicates: ZedMemoryEntry[];
  } {
    const unique = new Map<string, ZedMemoryEntry>();
    const duplicates: ZedMemoryEntry[] = [];

    for (const entry of entries) {
      // Create a hash key based on type and content
      const contentHash = this.createContentHash(entry);
      
      if (unique.has(contentHash)) {
        duplicates.push(entry);
      } else {
        unique.set(contentHash, entry);
      }
    }

    return {
      compressed: Array.from(unique.values()),
      duplicates
    };
  }

  private summarizeConversations(conversations: ZedConversation[]): { summaries: any[] } {
    const summaries = conversations.map(conversation => {
      const summary = this.generateConversationSummary(conversation);
      
      // Keep first few and last few messages, summarize the middle
      const messages = conversation.messages;
      const keepStart = messages.slice(0, 3);
      const keepEnd = messages.slice(-3);
      
      const summarizedMessages = [
        ...keepStart,
        {
          id: uuidv4(),
          role: 'system' as const,
          content: `[Conversation Summary: ${summary}]`,
          timestamp: new Date()
        },
        ...keepEnd
      ];

      return {
        ...conversation,
        messages: summarizedMessages,
        updatedAt: new Date(),
        compressed: true,
        originalMessageCount: messages.length
      };
    });

    return { summaries };
  }

  // UTILITY METHODS
  private generateConversationSummary(conversation: ZedConversation): string {
    const userMessages = conversation.messages.filter(m => m.role === 'user');
    const topics = userMessages.map(m => m.content.substring(0, 50)).join(', ');
    
    return `Conversation about: ${topics}. ${conversation.messages.length} messages exchanged.`;
  }

  private createContentHash(entry: ZedMemoryEntry): string {
    const hashContent = `${entry.type}_${JSON.stringify(entry.content).substring(0, 100)}`;
    return Buffer.from(hashContent).toString('base64');
  }

  private async saveCompressionSnapshot(userId: string, snapshot: CompressionSnapshot): Promise<void> {
    const snapshotsPath = path.join(process.cwd(), 'core', 'memory', 'users', userId, 'snapshots');
    await fs.mkdir(snapshotsPath, { recursive: true });
    
    const snapshotFile = path.join(snapshotsPath, `${snapshot.id}.json`);
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async getCompressionSnapshots(userId: string): Promise<CompressionSnapshot[]> {
    const snapshotsPath = path.join(process.cwd(), 'core', 'memory', 'users', userId, 'snapshots');
    
    try {
      const files = await fs.readdir(snapshotsPath);
      const snapshots = [];
      
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const filePath = path.join(snapshotsPath, file);
        const data = await fs.readFile(filePath, 'utf-8');
        snapshots.push(JSON.parse(data));
      }
      
      return snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  // COMPRESSION SCHEDULING
  private schedulePeriodicCompression(): void {
    setInterval(async () => {
      console.log('Running scheduled memory compression...');
      await this.runScheduledCompression();
    }, this.COMPRESSION_INTERVAL_HOURS * 60 * 60 * 1000);
  }

  private async runScheduledCompression(): Promise<void> {
    try {
      const userIds = await zedCoreMemoryService.getAllUserIds();
      
      for (const userId of userIds) {
        try {
          const stats = await zedCoreMemoryService.getMemoryStats(userId);
          
          // Check if compression is needed
          if (stats.memorySize > this.COMPRESSION_THRESHOLD) {
            console.log(`Compressing memory for user ${userId}`);
            await this.compressUserMemory(userId, false);
          }
        } catch (error) {
          console.error(`Error compressing memory for user ${userId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in scheduled compression:', error);
    }
  }

  // MANUAL TRIGGERS
  async triggerCompressionForUser(userId: string): Promise<CompressionSnapshot> {
    return await this.compressUserMemory(userId, true);
  }

  async triggerCompressionForAllUsers(): Promise<CompressionSnapshot[]> {
    const userIds = await zedCoreMemoryService.getAllUserIds();
    const results = [];
    
    for (const userId of userIds) {
      try {
        const snapshot = await this.compressUserMemory(userId, true);
        results.push(snapshot);
      } catch (error) {
        console.error(`Error compressing memory for user ${userId}:`, error);
      }
    }
    
    return results;
  }

  // COMPRESSION ANALYSIS
  async getCompressionAnalytics(userId: string): Promise<{
    totalCompressions: number;
    totalSpaceSaved: number;
    averageCompressionRatio: number;
    lastCompressionDate?: Date;
    compressionHistory: any[];
  }> {
    const userCore = await zedCoreMemoryService.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const history = userCore.compressionHistory;
    const totalSpaceSaved = history.reduce((sum, h) => sum + (h.sizeBefore - h.sizeAfter), 0);
    const averageRatio = history.length > 0 ? 
      history.reduce((sum, h) => sum + ((h.sizeBefore - h.sizeAfter) / h.sizeBefore), 0) / history.length : 0;

    return {
      totalCompressions: history.length,
      totalSpaceSaved,
      averageCompressionRatio: averageRatio,
      lastCompressionDate: history.length > 0 ? history[history.length - 1].compressedAt : undefined,
      compressionHistory: history
    };
  }
}

export const memoryCompressorService = new MemoryCompressorService();
