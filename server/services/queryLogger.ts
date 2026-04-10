import { nanoid } from 'nanoid';

export interface QueryLogData {
  userId: string;
  query: string;
  response: string;
  conversationId?: string;
  model?: string;
  duration?: number;
  metadata?: any;
}

export interface QueryLogFilters {
  userId?: string;
  conversationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  model?: string;
  limit?: number;
  offset?: number;
}

interface LogEntry {
  id: string;
  user_id: string;
  event_type: string;
  event_data: any;
  session_id?: string;
  conversation_id?: string;
  duration: number;
  metadata: any;
  created_at: Date;
}

const logs: LogEntry[] = [];

export class QueryLogger {
  static async logQuery(data: QueryLogData) {
    try {
      const entry: LogEntry = {
        id: nanoid(),
        user_id: data.userId,
        event_type: 'query_interaction',
        event_data: {
          query: data.query,
          response: data.response,
          model: data.model || 'ollama',
          query_length: data.query.length,
          response_length: data.response.length,
        },
        session_id: data.conversationId,
        conversation_id: data.conversationId,
        duration: data.duration || 0,
        metadata: {
          ...data.metadata,
          logged_at: new Date().toISOString(),
          zed_version: '1.0.0'
        },
        created_at: new Date()
      };
      logs.push(entry);
      console.log(`[QUERY_LOG] Logged interaction for user ${data.userId}`);
      return entry;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to log query:', error);
      throw new Error('Failed to log query interaction');
    }
  }

  static async getQueryLogs(filters: QueryLogFilters = {}) {
    try {
      let result = logs.filter(l => l.event_type === 'query_interaction');
      if (filters.userId) result = result.filter(l => l.user_id === filters.userId);
      if (filters.conversationId) result = result.filter(l => l.conversation_id === filters.conversationId);
      if (filters.dateFrom) result = result.filter(l => l.created_at >= filters.dateFrom!);
      if (filters.dateTo) result = result.filter(l => l.created_at <= filters.dateTo!);
      if (filters.model) result = result.filter(l => l.event_data?.model === filters.model);
      result = result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      return result.slice(offset, offset + limit);
    } catch (error) {
      console.error('[QUERY_LOG] Failed to fetch query logs:', error);
      throw new Error('Failed to fetch query logs');
    }
  }

  static async getUserQueryStats(userId: string, days: number = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const userLogs = logs.filter(l =>
        l.user_id === userId &&
        l.event_type === 'query_interaction' &&
        l.created_at >= since
      );
      const total = userLogs.length;
      const avgDuration = total > 0 ? userLogs.reduce((s, l) => s + l.duration, 0) / total : 0;
      const totalDuration = userLogs.reduce((s, l) => s + l.duration, 0);
      return {
        total_queries: total,
        avg_duration: avgDuration,
        total_duration: totalDuration,
        period_days: days,
        daily_stats: [],
        model_distribution: []
      };
    } catch (error) {
      console.error('[QUERY_LOG] Failed to get user stats:', error);
      throw new Error('Failed to get user query statistics');
    }
  }

  static async getTopQueries(userId?: string, limit: number = 10) {
    try {
      let result = logs.filter(l => l.event_type === 'query_interaction');
      if (userId) result = result.filter(l => l.user_id === userId);
      return result
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit)
        .map(l => ({
          query: l.event_data?.query || '',
          response_preview: (l.event_data?.response || '').substring(0, 100) + '...',
          user_email: l.user_id,
          duration: l.duration,
          timestamp: l.created_at
        }));
    } catch (error) {
      console.error('[QUERY_LOG] Failed to get top queries:', error);
      throw new Error('Failed to get top queries');
    }
  }

  static async cleanupOldLogs(daysToKeep: number = 90) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      const before = logs.length;
      logs.splice(0, logs.length, ...logs.filter(l => l.created_at >= cutoff));
      const removed = before - logs.length;
      console.log(`[QUERY_LOG] Cleaned up ${removed} old query logs`);
      return removed;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to cleanup old logs:', error);
      throw new Error('Failed to cleanup old query logs');
    }
  }

  static async searchQueries(searchTerm: string, userId?: string, limit: number = 20) {
    try {
      const term = searchTerm.toLowerCase();
      let result = logs.filter(l =>
        l.event_type === 'query_interaction' &&
        (
          l.event_data?.query?.toLowerCase().includes(term) ||
          l.event_data?.response?.toLowerCase().includes(term)
        )
      );
      if (userId) result = result.filter(l => l.user_id === userId);
      return result
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('[QUERY_LOG] Failed to search queries:', error);
      throw new Error('Failed to search queries');
    }
  }
}

export default QueryLogger;
