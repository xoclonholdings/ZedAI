import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ZedMemoryEntry {
  id: string;
  timestamp: Date;
  type: 'conversation' | 'preference' | 'upload' | 'generation' | 'bookmark' | 'role';
  content: any;
  metadata?: Record<string, any>;
}

export interface ZedConversation {
  id: string;
  route: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    attachments?: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZedUserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  responseStyle: 'concise' | 'detailed' | 'creative';
  enabledModules: string[];
  customPrompts: Record<string, string>;
}

export interface ZedCoreMemory {
  userId: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  authorizedEditors: string[];
  baseTemplate: string; // References admin template version
  
  // Core Memory Components
  personality: {
    baseTraits: Record<string, any>;
    learnedBehaviors: Record<string, any>;
    customizations: Record<string, any>;
  };
  
  conversations: ZedConversation[];
  uploads: Array<{
    id: string;
    filename: string;
    path: string;
    type: string;
    uploadedAt: Date;
    metadata?: Record<string, any>;
  }>;
  
  generations: Array<{
    id: string;
    type: 'document' | 'code' | 'image' | 'analysis';
    title: string;
    path: string;
    generatedAt: Date;
    prompt: string;
    metadata?: Record<string, any>;
  }>;
  
  preferences: ZedUserPreferences;
  bookmarks: Array<{
    id: string;
    title: string;
    url?: string;
    content?: string;
    tags: string[];
    createdAt: Date;
  }>;
  
  roles: Array<{
    id: string;
    name: string;
    description: string;
    permissions: string[];
    assignedAt: Date;
  }>;
  
  // Memory Management
  memoryEntries: ZedMemoryEntry[];
  compressionHistory: Array<{
    id: string;
    compressedAt: Date;
    entriesCompressed: number;
    sizeBefore: number;
    sizeAfter: number;
    method: string;
  }>;
}

export interface AdminZedCore {
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isTemplate: true;
  
  // Admin's core personality and knowledge
  basePersonality: Record<string, any>;
  adminKnowledge: Record<string, any>;
  systemPrompts: Record<string, string>;
  defaultModules: string[];
  defaultPreferences: ZedUserPreferences;
  
  // Template settings for new users
  templateSettings: {
    copyPersonality: boolean;
    copyKnowledge: boolean;
    copyPreferences: boolean;
    defaultRoles: string[];
  };
}

class ZedCoreMemoryService {
  private readonly coreMemoryPath = path.join(process.cwd(), 'core', 'memory');
  private readonly adminMemoryPath = path.join(this.coreMemoryPath, 'adminZED.json');
  private readonly usersMemoryPath = path.join(this.coreMemoryPath, 'users');
  private readonly uploadsPath = path.join(process.cwd(), 'user_uploads');
  private readonly outputPath = path.join(process.cwd(), 'ai_output');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.coreMemoryPath,
      this.usersMemoryPath,
      this.uploadsPath,
      this.outputPath
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  // ADMIN ZED CORE MANAGEMENT
  async saveAdminCore(adminCore: AdminZedCore): Promise<void> {
    await fs.writeFile(
      this.adminMemoryPath,
      JSON.stringify(adminCore, null, 2),
      'utf-8'
    );
  }

  async getAdminCore(): Promise<AdminZedCore | null> {
    try {
      const data = await fs.readFile(this.adminMemoryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async initializeAdminCoreFromImport(importedData: any): Promise<AdminZedCore> {
    const adminCore: AdminZedCore = {
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isTemplate: true,
      basePersonality: importedData.personality || {},
      adminKnowledge: importedData.knowledge || {},
      systemPrompts: importedData.systemPrompts || {},
      defaultModules: importedData.modules || ['chat', 'analysis', 'generation'],
      defaultPreferences: {
        theme: 'dark',
        language: 'en',
        responseStyle: 'detailed',
        enabledModules: ['chat', 'analysis', 'generation'],
        customPrompts: importedData.customPrompts || {}
      },
      templateSettings: {
        copyPersonality: true,
        copyKnowledge: true,
        copyPreferences: true,
        defaultRoles: ['user']
      }
    };

    await this.saveAdminCore(adminCore);
    return adminCore;
  }

  // USER ZED CORE MANAGEMENT
  private getUserMemoryPath(userId: string): string {
    return path.join(this.usersMemoryPath, userId, 'zed.json');
  }

  private getUserSnapshotsPath(userId: string): string {
    return path.join(this.usersMemoryPath, userId, 'snapshots');
  }

  private getUserUploadsPath(userId: string): string {
    return path.join(this.uploadsPath, userId);
  }

  private getUserOutputPath(userId: string): string {
    return path.join(this.outputPath, userId);
  }

  async createUserZedCore(userId: string, adminId: string): Promise<ZedCoreMemory> {
    const adminCore = await this.getAdminCore();
    if (!adminCore) {
      throw new Error('Admin core not found. Initialize admin core first.');
    }

    // Ensure user directories exist
    const userMemoryDir = path.dirname(this.getUserMemoryPath(userId));
    const userSnapshotsDir = this.getUserSnapshotsPath(userId);
    const userUploadsDir = this.getUserUploadsPath(userId);
    const userOutputDir = this.getUserOutputPath(userId);

    await Promise.all([
      fs.mkdir(userMemoryDir, { recursive: true }),
      fs.mkdir(userSnapshotsDir, { recursive: true }),
      fs.mkdir(userUploadsDir, { recursive: true }),
      fs.mkdir(userOutputDir, { recursive: true })
    ]);

    const userCore: ZedCoreMemory = {
      userId,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      authorizedEditors: [adminId, userId],
      baseTemplate: adminCore.version,
      
      personality: {
        baseTraits: adminCore.templateSettings.copyPersonality ? 
          { ...adminCore.basePersonality } : {},
        learnedBehaviors: {},
        customizations: {}
      },
      
      conversations: [],
      uploads: [],
      generations: [],
      
      preferences: adminCore.templateSettings.copyPreferences ? 
        { ...adminCore.defaultPreferences } : {
          theme: 'light',
          language: 'en',
          responseStyle: 'concise',
          enabledModules: ['chat'],
          customPrompts: {}
        },
      
      bookmarks: [],
      roles: adminCore.templateSettings.defaultRoles.map(roleName => ({
        id: uuidv4(),
        name: roleName,
        description: `Default ${roleName} role`,
        permissions: roleName === 'admin' ? ['*'] : ['read', 'write'],
        assignedAt: new Date()
      })),
      
      memoryEntries: [],
      compressionHistory: []
    };

    await this.saveUserCore(userCore);
    return userCore;
  }

  async getUserCore(userId: string): Promise<ZedCoreMemory | null> {
    try {
      const data = await fs.readFile(this.getUserMemoryPath(userId), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveUserCore(userCore: ZedCoreMemory): Promise<void> {
    userCore.updatedAt = new Date();
    await fs.writeFile(
      this.getUserMemoryPath(userCore.userId),
      JSON.stringify(userCore, null, 2),
      'utf-8'
    );
  }

  async getOrCreateUserCore(userId: string, adminId: string): Promise<ZedCoreMemory> {
    let userCore = await this.getUserCore(userId);
    if (!userCore) {
      userCore = await this.createUserZedCore(userId, adminId);
    }
    return userCore;
  }

  // MEMORY ENTRY MANAGEMENT
  async addMemoryEntry(userId: string, entry: Omit<ZedMemoryEntry, 'id'>): Promise<string> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const memoryEntry: ZedMemoryEntry = {
      id: uuidv4(),
      ...entry,
      timestamp: new Date()
    };

    userCore.memoryEntries.push(memoryEntry);
    await this.saveUserCore(userCore);
    
    return memoryEntry.id;
  }

  async addConversation(userId: string, conversation: Omit<ZedConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const newConversation: ZedConversation = {
      id: uuidv4(),
      ...conversation,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    userCore.conversations.push(newConversation);
    await this.saveUserCore(userCore);
    
    return newConversation.id;
  }

  async updateConversation(userId: string, conversationId: string, updates: Partial<ZedConversation>): Promise<void> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const conversationIndex = userCore.conversations.findIndex(c => c.id === conversationId);
    if (conversationIndex === -1) {
      throw new Error('Conversation not found');
    }

    userCore.conversations[conversationIndex] = {
      ...userCore.conversations[conversationIndex],
      ...updates,
      updatedAt: new Date()
    };

    await this.saveUserCore(userCore);
  }

  async addUpload(userId: string, uploadData: {
    filename: string;
    type: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const uploadId = uuidv4();
    const uploadPath = path.join(this.getUserUploadsPath(userId), uploadId + path.extname(uploadData.filename));

    const upload = {
      id: uploadId,
      filename: uploadData.filename,
      path: uploadPath,
      type: uploadData.type,
      uploadedAt: new Date(),
      metadata: uploadData.metadata
    };

    userCore.uploads.push(upload);
    await this.saveUserCore(userCore);
    
    return uploadId;
  }

  async addGeneration(userId: string, generation: {
    type: 'document' | 'code' | 'image' | 'analysis';
    title: string;
    content: any;
    prompt: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const generationId = uuidv4();
    const filename = `${generationId}.${generation.type === 'document' ? 'md' : 
                     generation.type === 'code' ? 'txt' : 
                     generation.type === 'image' ? 'png' : 'json'}`;
    const generationPath = path.join(this.getUserOutputPath(userId), filename);

    // Save the generated content to file
    await fs.writeFile(generationPath, 
      typeof generation.content === 'string' ? generation.content : JSON.stringify(generation.content, null, 2),
      'utf-8'
    );

    const generationEntry = {
      id: generationId,
      type: generation.type,
      title: generation.title,
      path: generationPath,
      generatedAt: new Date(),
      prompt: generation.prompt,
      metadata: generation.metadata
    };

    userCore.generations.push(generationEntry);
    await this.saveUserCore(userCore);
    
    return generationId;
  }

  // PREFERENCES MANAGEMENT
  async updatePreferences(userId: string, preferences: Partial<ZedUserPreferences>): Promise<void> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    userCore.preferences = { ...userCore.preferences, ...preferences };
    await this.saveUserCore(userCore);
  }

  // BOOKMARKS MANAGEMENT
  async addBookmark(userId: string, bookmark: {
    title: string;
    url?: string;
    content?: string;
    tags: string[];
  }): Promise<string> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const bookmarkEntry = {
      id: uuidv4(),
      ...bookmark,
      createdAt: new Date()
    };

    userCore.bookmarks.push(bookmarkEntry);
    await this.saveUserCore(userCore);
    
    return bookmarkEntry.id;
  }

  // AUTHORIZATION
  async isAuthorizedEditor(userId: string, editorId: string): Promise<boolean> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      return false;
    }

    return userCore.authorizedEditors.includes(editorId);
  }

  async addAuthorizedEditor(userId: string, editorId: string, requesterId: string): Promise<void> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    if (!userCore.authorizedEditors.includes(requesterId)) {
      throw new Error('Unauthorized to add editors');
    }

    if (!userCore.authorizedEditors.includes(editorId)) {
      userCore.authorizedEditors.push(editorId);
      await this.saveUserCore(userCore);
    }
  }

  // MEMORY STATISTICS
  async getMemoryStats(userId: string): Promise<{
    totalEntries: number;
    totalConversations: number;
    totalUploads: number;
    totalGenerations: number;
    totalBookmarks: number;
    memorySize: number;
    lastCompression?: Date;
  }> {
    const userCore = await this.getUserCore(userId);
    if (!userCore) {
      throw new Error('User core not found');
    }

    const memorySize = JSON.stringify(userCore).length;
    const lastCompression = userCore.compressionHistory.length > 0 ? 
      userCore.compressionHistory[userCore.compressionHistory.length - 1].compressedAt : undefined;

    return {
      totalEntries: userCore.memoryEntries.length,
      totalConversations: userCore.conversations.length,
      totalUploads: userCore.uploads.length,
      totalGenerations: userCore.generations.length,
      totalBookmarks: userCore.bookmarks.length,
      memorySize,
      lastCompression
    };
  }

  // LIST ALL USERS (Admin only)
  async getAllUserIds(): Promise<string[]> {
    try {
      const userDirs = await fs.readdir(this.usersMemoryPath);
      return userDirs.filter(async (dir) => {
        const userMemoryFile = path.join(this.usersMemoryPath, dir, 'zed.json');
        try {
          await fs.access(userMemoryFile);
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }
}

export const zedCoreMemoryService = new ZedCoreMemoryService();
