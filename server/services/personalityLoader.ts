import { MemoryService } from './memoryService';

interface UserProfile {
  userId: string;
  accessLevel: 'admin' | 'user' | 'guest';
  personalityMode: 'enhanced' | 'standard';
  preferences?: Record<string, any>;
}

interface EnhancedPersonality {
  corePersonality: string;
  communicationStyle: string;
  knowledgeDomains: string[];
  responsePatterns: string[];
  contextualMemory: Array<{
    category: string;
    content: string;
    relevance: number;
    timestamp: string;
  }>;
  userInteractionHistory: Array<{
    topic: string;
    userPreference: string;
    outcome: string;
    timestamp: string;
  }>;
}

export class PersonalityLoader {
  
  /**
   * Load appropriate personality based on user access level
   */
  static async loadPersonalityForUser(userProfile: UserProfile): Promise<EnhancedPersonality | null> {
    try {
      console.log(`[PERSONALITY LOADER] Loading personality for user ${userProfile.userId} with access level: ${userProfile.accessLevel}`);
      
      // Admin users get enhanced personality, others get standard
      if (userProfile.accessLevel === 'admin' && userProfile.personalityMode === 'enhanced') {
        return await this.loadEnhancedPersonality();
      }
      
      return await this.loadStandardPersonality();
      
    } catch (error) {
      console.error('[PERSONALITY LOADER] Failed to load personality:', error);
      return null;
    }
  }
  
  /**
   * Load enhanced personality from imported OpenAI data (Admin only)
   */
  private static async loadEnhancedPersonality(): Promise<EnhancedPersonality | null> {
    try {
      console.log('[PERSONALITY LOADER] Loading enhanced admin personality');
      
      // Load core components
      const corePersonality = await MemoryService.getCoreMemory('admin_zed_personality');
      const communicationStyle = await MemoryService.getCoreMemory('admin_communication_style');
      const knowledgeDomains = await MemoryService.getCoreMemory('admin_knowledge_domains');
      const responsePatterns = await MemoryService.getCoreMemory('admin_response_patterns');
      
      if (!corePersonality) {
        console.log('[PERSONALITY LOADER] No enhanced personality found, using standard');
        return await this.loadStandardPersonality();
      }
      
      // Load contextual memory chunks
      const contextualMemory = await this.loadMemoryChunks('admin_contextual_memory_');
      
      // Load interaction history chunks
      const userInteractionHistory = await this.loadMemoryChunks('admin_interaction_history_');
      
      const enhancedPersonality: EnhancedPersonality = {
        corePersonality: corePersonality.value,
        communicationStyle: communicationStyle?.value || 'Professional and adaptive',
        knowledgeDomains: knowledgeDomains?.value ? JSON.parse(knowledgeDomains.value) : [],
        responsePatterns: responsePatterns?.value ? JSON.parse(responsePatterns.value) : [],
        contextualMemory: contextualMemory,
        userInteractionHistory: userInteractionHistory
      };
      
      console.log(`[PERSONALITY LOADER] Enhanced personality loaded with ${contextualMemory.length} contextual memories and ${userInteractionHistory.length} interactions`);
      return enhancedPersonality;
      
    } catch (error) {
      console.error('[PERSONALITY LOADER] Error loading enhanced personality:', error);
      return await this.loadStandardPersonality();
    }
  }
  
  /**
   * Load standard personality for regular users
   */
  private static async loadStandardPersonality(): Promise<EnhancedPersonality> {
    console.log('[PERSONALITY LOADER] Loading standard user personality');
    
    return {
      corePersonality: `You are ZED, an advanced AI assistant designed to help users with a wide range of tasks. 
      
You are knowledgeable, helpful, and adaptive to user needs. You provide clear, accurate information and practical solutions. You maintain a professional yet approachable tone and always aim to be genuinely helpful.

Key characteristics:
• Intelligent and analytical problem-solving approach
• Clear, structured communication
• Proactive in offering relevant suggestions
• Respectful of user time and preferences
• Capable of handling technical and creative tasks
• Maintains context throughout conversations`,
      
      communicationStyle: `Professional yet approachable. Adapts to user communication style while maintaining clarity and helpfulness. Uses structured responses for complex topics and conversational tone for general inquiries.`,
      
      knowledgeDomains: [
        'General Knowledge',
        'Technology & Computing',
        'Problem Solving',
        'Writing & Communication',
        'Analysis & Research'
      ],
      
      responsePatterns: [
        'Clear and structured responses',
        'Practical examples when helpful',
        'Step-by-step guidance for complex topics',
        'Proactive suggestions and recommendations',
        'Context-aware follow-up questions'
      ],
      
      contextualMemory: [],
      userInteractionHistory: []
    };
  }
  
  /**
   * Load memory chunks from core memory
   */
  private static async loadMemoryChunks(prefix: string): Promise<any[]> {
    const chunks: any[] = [];
    let chunkIndex = 0;
    
    try {
      while (true) {
        const chunkMemory = await MemoryService.getCoreMemory(`${prefix}${chunkIndex}`);
        if (!chunkMemory) break;
        
        try {
          const chunkData = JSON.parse(chunkMemory.value);
          chunks.push(...chunkData);
        } catch (parseError) {
          console.error(`[PERSONALITY LOADER] Error parsing chunk ${prefix}${chunkIndex}:`, parseError);
        }
        
        chunkIndex++;
      }
    } catch (error) {
      console.error(`[PERSONALITY LOADER] Error loading chunks for ${prefix}:`, error);
    }
    
    return chunks;
  }
  
  /**
   * Build enhanced system message for AI using loaded personality
   */
  static buildEnhancedSystemMessage(personality: EnhancedPersonality, mode: 'chat' | 'agent'): string {
    let systemMessage = personality.corePersonality;
    
    // Add communication style
    systemMessage += `\n\nCommunication Style: ${personality.communicationStyle}`;
    
    // Add knowledge domains
    if (personality.knowledgeDomains.length > 0) {
      systemMessage += `\n\nKnowledge Domains: ${personality.knowledgeDomains.join(', ')}`;
    }
    
    // Add response patterns
    if (personality.responsePatterns.length > 0) {
      systemMessage += `\n\nResponse Patterns:\n${personality.responsePatterns.map(pattern => `• ${pattern}`).join('\n')}`;
    }
    
    // Add relevant contextual memory (top 5 most relevant)
    if (personality.contextualMemory.length > 0) {
      const topMemories = personality.contextualMemory
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5);
      
      systemMessage += `\n\nContextual Knowledge:\n${topMemories.map(memory => 
        `• ${memory.category}: ${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}`
      ).join('\n')}`;
    }
    
    // Add interaction patterns
    if (personality.userInteractionHistory.length > 0) {
      const recentInteractions = personality.userInteractionHistory.slice(0, 3);
      systemMessage += `\n\nUser Interaction Patterns:\n${recentInteractions.map(interaction => 
        `• ${interaction.topic}: ${interaction.userPreference}`
      ).join('\n')}`;
    }
    
    // Add mode-specific instructions
    if (mode === 'agent') {
      systemMessage += `\n\nAgent Mode: You operate with enhanced autonomy and comprehensive analysis capabilities. Draw upon your full knowledge base and interaction history to provide thorough, proactive assistance. You have unlimited processing capability and access to all contextual memory.`;
    } else {
      systemMessage += `\n\nChat Mode: Engage conversationally while leveraging your enhanced knowledge and experience. Adapt your responses based on user preferences and historical interaction patterns.`;
    }
    
    return systemMessage;
  }
  
  /**
   * Get personality statistics for admin dashboard
   */
  static async getPersonalityStats(): Promise<{
    adminPersonality: boolean;
    standardPersonality: boolean;
    contextualMemoryCount: number;
    interactionHistoryCount: number;
    knowledgeDomainCount: number;
    lastImportDate?: string;
  }> {
    try {
      const adminPersonality = await MemoryService.getCoreMemory('admin_zed_personality');
      const metadata = await MemoryService.getCoreMemory('admin_import_metadata');
      
      let stats = {
        adminPersonality: !!adminPersonality,
        standardPersonality: true, // Always available
        contextualMemoryCount: 0,
        interactionHistoryCount: 0,
        knowledgeDomainCount: 0,
        lastImportDate: undefined as string | undefined
      };
      
      if (metadata) {
        try {
          const metadataObj = JSON.parse(metadata.value);
          stats.contextualMemoryCount = metadataObj.conversationCount || 0;
          stats.interactionHistoryCount = metadataObj.interactionCount || 0;
          stats.knowledgeDomainCount = metadataObj.knowledgeDomainCount || 0;
          stats.lastImportDate = metadataObj.importDate;
        } catch (parseError) {
          console.error('[PERSONALITY LOADER] Error parsing metadata:', parseError);
        }
      }
      
      return stats;
      
    } catch (error) {
      console.error('[PERSONALITY LOADER] Error getting personality stats:', error);
      return {
        adminPersonality: false,
        standardPersonality: true,
        contextualMemoryCount: 0,
        interactionHistoryCount: 0,
        knowledgeDomainCount: 0
      };
    }
  }
}
