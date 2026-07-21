import type {
  User,
  UpsertUser,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  File,
  InsertFile,
  Session,
  InsertSession,
  CoreMemory,
  InsertCoreMemory,
  ProjectMemory,
  InsertProjectMemory,
  ScratchpadMemory,
  InsertScratchpadMemory,
} from "../../shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(userData: any): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, userData: Partial<any>): Promise<User>;
  deleteUser(id: string): Promise<boolean>;

  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsByUser(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;

  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: string): Promise<boolean>;
  batchCreateMessages(messages: InsertMessage[]): Promise<Message[]>;

  getFile(id: string): Promise<File | undefined>;
  getFilesByConversation(conversationId: string): Promise<File[]>;
  findFileByChecksum(conversationId: string, checksum: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, updates: Partial<File>): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;
  storeFileChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: string,
    chunkSize: number
  ): Promise<boolean>;
  getFileChunks(
    fileId: string
  ): Promise<{ chunkIndex: number; chunkData: string; chunkSize: number }[]>;

  getSession(conversationId: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined>;

  getCoreMemoryByKey(key: string): Promise<CoreMemory | null>;
  upsertCoreMemory(data: InsertCoreMemory): Promise<CoreMemory>;
  getAllCoreMemory(): Promise<CoreMemory[]>;

  getProjectMemoryByUser(userId: string): Promise<ProjectMemory[]>;
  createProjectMemory(data: InsertProjectMemory): Promise<ProjectMemory>;
  updateProjectMemory(id: string, updates: Partial<InsertProjectMemory>): Promise<ProjectMemory>;
  deleteProjectMemory(id: string): Promise<boolean>;

  getScratchpadMemoryByUser(userId: string): Promise<ScratchpadMemory[]>;
  createScratchpadMemory(data: InsertScratchpadMemory): Promise<ScratchpadMemory>;
  deleteScratchpadMemory(id: string): Promise<boolean>;
  cleanupExpiredScratchpadMemory(): Promise<void>;

  searchConversations(userId: string, query: string): Promise<Conversation[]>;
  getRecentActivity(userId: string, limit?: number): Promise<any[]>;
  cleanupExpiredData(): Promise<void>;
  getCacheStats(): any;
  optimizeStorage(): Promise<void>;

  executeWithFallback<T>(
    operationName: string,
    dbOperation: () => Promise<T>,
    fallbackKey: string,
    defaultValue?: T
  ): Promise<T>;
}
