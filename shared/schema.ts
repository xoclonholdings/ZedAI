export {
  users,
  insertUserSchema,
} from "./UsersSchema";

export type {
  User,
  UpsertUser,
  InsertUser,
  InsertUserSchema,
} from "./UsersSchema";

export {
  conversations,
  modeSchema,
  insertConversationSchema,
} from "./ConversationsSchema";

export type {
  Conversation,
  InsertConversation,
  ConversationMode,
} from "./ConversationsSchema";

export {
  messages,
  insertMessageSchema,
} from "./MessagesSchema";

export type {
  Message,
  InsertMessage,
} from "./MessagesSchema";

export {
  files,
  insertFileSchema,
} from "./FilesSchema";

export type {
  File,
  InsertFile,
} from "./FilesSchema";

export {
  chatSessions,
  insertSessionSchema,
} from "./SessionsSchema";

export type {
  Session,
  InsertSession,
} from "./SessionsSchema";

export {
  coreMemory,
  projectMemory,
  scratchpadMemory,
  insertCoreMemorySchema,
  insertProjectMemorySchema,
  insertScratchpadMemorySchema,
} from "./MemorySchema";

export type {
  CoreMemory,
  InsertCoreMemory,
  ProjectMemory,
  InsertProjectMemory,
  ScratchpadMemory,
  InsertScratchpadMemory,
} from "./MemorySchema";

export {
  fileStorage,
  memoryIndex,
  knowledgeBase,
  cacheStorage,
  analytics,
  userRelations,
  conversationRelations,
  messageRelations,
  fileRelations,
} from "./SystemSchema";

export {
  learningState,
} from "./LearningSchema";

export type {
  LearningStateRow,
} from "./LearningSchema";

export type {
  FileStorage,
  InsertFileStorage,
  MemoryIndex,
  InsertMemoryIndex,
  KnowledgeBase,
  InsertKnowledgeBase,
  CacheStorage,
  InsertCacheStorage,
  Analytics,
  InsertAnalytics,
} from "./SystemSchema";

export type AgentTarget = "operations" | "research" | "business" | "finance";
