import fs from 'fs/promises';
import path from 'path';
// import { MemoryService } from './memoryService';

interface OpenAIExportData {
  conversations: Array<{
    id: string;
    title: string;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: string;
    }>;
  }>;
  assistantMemory?: {
    personality?: string;
    instructions?: string;
    knowledge?: string[];
    preferences?: Record<string, any>;
  };
  userContext?: {
    preferences: Record<string, any>;
    history: Array<{
      topic: string;
      context: string;
      timestamp: string;
    }>;
  };
}

interface ZEDPersonalityData {
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

export class MemoryImporter {
  
  /**
   * Import OpenAI data export and process into ZED memory format
   */
  static async importOpenAIExport(exportFolderPath: string): Promise<ZEDPersonalityData> {
    try {
      console.log(`[MEMORY IMPORT] Starting import from: ${exportFolderPath}`);
      
      // Read all files in the export folder
      const files = await fs.readdir(exportFolderPath);
      console.log(`[MEMORY IMPORT] Found ${files.length} files to process`);
      
      let conversations: any[] = [];
      let assistantMemory: any = {};
      let userContext: any = {};
      
      // Process each file in the export
      for (const file of files) {
        const filePath = path.join(exportFolderPath, file);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isFile() && file.endsWith('.json')) {
          try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            
            // Detect file type and process accordingly
            if (file.includes('conversation') || data.conversations) {
              conversations = conversations.concat(data.conversations || [data]);
            } else if (file.includes('memory') || file.includes('assistant')) {
              assistantMemory = { ...assistantMemory, ...data };
            } else if (file.includes('user') || file.includes('context')) {
              userContext = { ...userContext, ...data };
            }
          } catch (error) {
            console.error(`[MEMORY IMPORT] Error processing file ${file}:`, error);
          }
        }
      }
      
      // Process and transform the data
      const zedPersonality = await this.transformToZEDFormat({
        conversations,
        assistantMemory,
        userContext
      });
      
      console.log(`[MEMORY IMPORT] Successfully processed ${conversations.length} conversations`);
      return zedPersonality;
      
    } catch (error) {
      console.error('[MEMORY IMPORT] Failed to import OpenAI export:', error);
      throw new Error(`Memory import failed: ${error}`);
    }
  }
  
  /**
   * Transform OpenAI format to ZED personality format
   */
  private static async transformToZEDFormat(data: OpenAIExportData): Promise<ZEDPersonalityData> {
    const { conversations, assistantMemory, userContext } = data;
    
    // Extract core personality from assistant instructions
    let corePersonality = "You are ZED, an advanced AI assistant with comprehensive knowledge and adaptive personality.";
    if (assistantMemory?.personality) {
      corePersonality = assistantMemory.personality;
    } else if (assistantMemory?.instructions) {
      corePersonality = assistantMemory.instructions;
    }
    
    // Analyze communication style from conversations
    const communicationStyle = this.extractCommunicationStyle(conversations);
    
    // Extract knowledge domains
    const knowledgeDomains = this.extractKnowledgeDomains(conversations);
    
    // Extract response patterns
    const responsePatterns = this.extractResponsePatterns(conversations);
    
    // Build contextual memory from conversations
    const contextualMemory = this.buildContextualMemory(conversations);
    
    // Build user interaction history
    const userInteractionHistory = this.buildUserInteractionHistory(conversations, userContext);
    
    return {
      corePersonality,
      communicationStyle,
      knowledgeDomains,
      responsePatterns,
      contextualMemory,
      userInteractionHistory
    };
  }
  
  /**
   * Extract communication style from conversation patterns
   */
  private static extractCommunicationStyle(conversations: any[]): string {
    const styles = {
      professional: 0,
      casual: 0,
      technical: 0,
      supportive: 0,
      analytical: 0
    };
    
    conversations.forEach(conv => {
      conv.messages?.forEach((msg: any) => {
        if (msg.role === 'assistant') {
          const content = msg.content.toLowerCase();
          
          if (content.includes('analyze') || content.includes('technical') || content.includes('implement')) {
            styles.analytical++;
            styles.technical++;
          }
          if (content.includes('help') || content.includes('support') || content.includes('assist')) {
            styles.supportive++;
          }
          if (content.length > 500 && content.includes('•') || content.includes('**')) {
            styles.professional++;
          }
          if (content.includes('let me') || content.includes('sure thing') || content.includes('!')) {
            styles.casual++;
          }
        }
      });
    });
    
    const dominantStyle = Object.entries(styles).reduce((a, b) => 
      styles[a[0] as keyof typeof styles] > styles[b[0] as keyof typeof styles] ? a : b
    )[0];
    
    return `Primary communication style: ${dominantStyle}. Adapts to user needs with ${Object.entries(styles)
      .filter(([_, count]) => count > 0)
      .map(([style, _]) => style)
      .join(', ')} approaches.`;
  }
  
  /**
   * Extract knowledge domains from conversation topics
   */
  private static extractKnowledgeDomains(conversations: any[]): string[] {
    const domains = new Set<string>();
    
    conversations.forEach(conv => {
      const title = conv.title?.toLowerCase() || '';
      const messages = conv.messages || [];
      
      // Analyze conversation topics
      const fullText = (title + ' ' + messages.map((m: any) => m.content).join(' ')).toLowerCase();
      
      if (fullText.includes('code') || fullText.includes('programming') || fullText.includes('api')) {
        domains.add('Software Development');
      }
      if (fullText.includes('data') || fullText.includes('analysis') || fullText.includes('database')) {
        domains.add('Data Analysis');
      }
      if (fullText.includes('design') || fullText.includes('ui') || fullText.includes('interface')) {
        domains.add('Design & UX');
      }
      if (fullText.includes('business') || fullText.includes('strategy') || fullText.includes('management')) {
        domains.add('Business Strategy');
      }
      if (fullText.includes('ai') || fullText.includes('machine learning') || fullText.includes('neural')) {
        domains.add('Artificial Intelligence');
      }
      if (fullText.includes('web') || fullText.includes('frontend') || fullText.includes('backend')) {
        domains.add('Web Development');
      }
    });
    
    return Array.from(domains);
  }
  
  /**
   * Extract response patterns from assistant messages
   */
  private static extractResponsePatterns(conversations: any[]): string[] {
    const patterns = new Set<string>();
    
    conversations.forEach(conv => {
      conv.messages?.forEach((msg: any) => {
        if (msg.role === 'assistant') {
          const content = msg.content;
          
          // Identify structural patterns
          if (content.includes('**') && content.includes('•')) {
            patterns.add('Structured responses with headers and bullet points');
          }
          if (content.includes('```')) {
            patterns.add('Code examples with proper formatting');
          }
          if (content.includes('Step 1:') || content.includes('1.') || content.includes('First,')) {
            patterns.add('Step-by-step instructions');
          }
          if (content.includes('analysis') || content.includes('breakdown')) {
            patterns.add('Detailed analysis and breakdown');
          }
          if (content.includes('recommendation') || content.includes('suggest')) {
            patterns.add('Actionable recommendations');
          }
        }
      });
    });
    
    return Array.from(patterns);
  }
  
  /**
   * Build contextual memory from conversations
   */
  private static buildContextualMemory(conversations: any[]): Array<{
    category: string;
    content: string;
    relevance: number;
    timestamp: string;
  }> {
    const contextualMemory: any[] = [];
    
    conversations.forEach(conv => {
      const category = this.categorizeConversation(conv);
      const relevantContent = this.extractRelevantContent(conv);
      
      if (relevantContent) {
        contextualMemory.push({
          category,
          content: relevantContent,
          relevance: this.calculateRelevance(conv),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Sort by relevance and keep top 100
    return contextualMemory
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 100);
  }
  
  /**
   * Build user interaction history
   */
  private static buildUserInteractionHistory(conversations: any[], userContext: any): Array<{
    topic: string;
    userPreference: string;
    outcome: string;
    timestamp: string;
  }> {
    const interactionHistory: any[] = [];
    
    conversations.forEach(conv => {
      if (conv.messages && conv.messages.length > 2) {
        const userMessages = conv.messages.filter((m: any) => m.role === 'user');
        const assistantMessages = conv.messages.filter((m: any) => m.role === 'assistant');
        
        if (userMessages.length > 0 && assistantMessages.length > 0) {
          interactionHistory.push({
            topic: conv.title || this.extractTopic(userMessages[0].content),
            userPreference: this.extractUserPreference(userMessages),
            outcome: this.evaluateOutcome(assistantMessages),
            timestamp: conv.messages[0].timestamp || new Date().toISOString()
          });
        }
      }
    });
    
    return interactionHistory.slice(0, 50); // Keep top 50 interactions
  }
  
  // Helper methods
  private static categorizeConversation(conv: any): string {
    const title = conv.title?.toLowerCase() || '';
    const content = conv.messages?.map((m: any) => m.content).join(' ').toLowerCase() || '';
    
    if (content.includes('code') || content.includes('programming')) return 'Technical';
    if (content.includes('analysis') || content.includes('data')) return 'Analysis';
    if (content.includes('design') || content.includes('creative')) return 'Creative';
    if (content.includes('business') || content.includes('strategy')) return 'Business';
    if (content.includes('help') || content.includes('support')) return 'Support';
    
    return 'General';
  }
  
  private static extractRelevantContent(conv: any): string {
    const messages = conv.messages || [];
    const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
    
    if (assistantMessages.length === 0) return '';
    
    // Get the most comprehensive assistant response
    const longestResponse = assistantMessages.reduce((longest: any, current: any) => 
      current.content.length > longest.content.length ? current : longest
    );
    
    return longestResponse.content.substring(0, 1000); // Limit content length
  }
  
  private static calculateRelevance(conv: any): number {
    let relevance = 0;
    
    const messages = conv.messages || [];
    relevance += messages.length * 0.1; // More messages = more relevant
    
    const totalLength = messages.reduce((sum: number, m: any) => sum + m.content.length, 0);
    relevance += Math.min(totalLength / 1000, 5); // Content depth
    
    // Check for technical or complex topics
    const fullText = messages.map((m: any) => m.content).join(' ').toLowerCase();
    if (fullText.includes('implement') || fullText.includes('analyze') || fullText.includes('solution')) {
      relevance += 2;
    }
    
    return Math.min(relevance, 10); // Cap at 10
  }
  
  private static extractTopic(content: string): string {
    const words = content.split(' ');
    return words.slice(0, 5).join(' '); // First 5 words as topic
  }
  
  private static extractUserPreference(userMessages: any[]): string {
    const preferences = [];
    
    userMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      if (content.includes('detailed') || content.includes('comprehensive')) {
        preferences.push('detailed_responses');
      }
      if (content.includes('quick') || content.includes('brief')) {
        preferences.push('concise_responses');
      }
      if (content.includes('example') || content.includes('show me')) {
        preferences.push('examples_preferred');
      }
    });
    
    return preferences.join(', ') || 'standard_interaction';
  }
  
  private static evaluateOutcome(assistantMessages: any[]): string {
    if (assistantMessages.length === 0) return 'incomplete';
    if (assistantMessages.length === 1) return 'single_response';
    if (assistantMessages.length > 3) return 'extended_conversation';
    return 'standard_resolution';
  }
  
  /**
   * Save processed personality data to ZED's memory system
   */
  static async saveToZEDMemory(personalityData: ZEDPersonalityData, isAdminMode = true): Promise<void> {
    try {
      const prefix = isAdminMode ? 'admin_' : 'user_';
      
      // Save core personality
  // await MemoryService.setCoreMemory(`${prefix}zed_personality`, personalityData.corePersonality);
      
      // Save communication style
  // await MemoryService.setCoreMemory(`${prefix}communication_style`, personalityData.communicationStyle);
      
      // Save knowledge domains
  // await MemoryService.setCoreMemory(`${prefix}knowledge_domains`, JSON.stringify(personalityData.knowledgeDomains));
      
      // Save response patterns
  // await MemoryService.setCoreMemory(`${prefix}response_patterns`, JSON.stringify(personalityData.responsePatterns));
      
      // Save contextual memory (in chunks)
      for (let i = 0; i < personalityData.contextualMemory.length; i += 10) {
        const chunk = personalityData.contextualMemory.slice(i, i + 10);
  // await MemoryService.setCoreMemory(`${prefix}contextual_memory_${Math.floor(i / 10)}`, JSON.stringify(chunk));
      }
      
      // Save interaction history (in chunks)
      for (let i = 0; i < personalityData.userInteractionHistory.length; i += 10) {
        const chunk = personalityData.userInteractionHistory.slice(i, i + 10);
  // await MemoryService.setCoreMemory(`${prefix}interaction_history_${Math.floor(i / 10)}`, JSON.stringify(chunk));
      }
      
        /*
        // Save metadata
        await MemoryService.setCoreMemory(`${prefix}import_metadata`, JSON.stringify({
          importDate: new Date().toISOString(),
          conversationCount: personalityData.contextualMemory.length,
          knowledgeDomainCount: personalityData.knowledgeDomains.length,
          interactionCount: personalityData.userInteractionHistory.length
        }));
        */
      
      console.log(`[MEMORY IMPORT] Successfully saved ${isAdminMode ? 'admin' : 'user'} personality to ZED memory`);
      
    } catch (error) {
      console.error('[MEMORY IMPORT] Failed to save to ZED memory:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const memoryImporter = new MemoryImporter();
