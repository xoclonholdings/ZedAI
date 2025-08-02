import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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

export class QueryLogger {
  
  /**
   * Log a new query-response interaction
   */
  static async logQuery(data: QueryLogData) {
    try {
      const logEntry = await prisma.analytics.create({
        data: {
          id: nanoid(),
          user_id: data.userId,
          event_type: 'query_interaction',
          event_data: {
            query: data.query,
            response: data.response,
            model: data.model || 'gpt-4o',
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
        }
      });

      console.log(`[QUERY_LOG] Logged interaction for user ${data.userId}`);
      return logEntry;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to log query:', error);
      throw new Error('Failed to log query interaction');
    }
  }

  /**
   * Get query logs with filtering
   */
  static async getQueryLogs(filters: QueryLogFilters = {}) {
    try {
      const where: any = {
        event_type: 'query_interaction'
      };

      if (filters.userId) {
        where.user_id = filters.userId;
      }

      if (filters.conversationId) {
        where.conversation_id = filters.conversationId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.created_at = {};
        if (filters.dateFrom) {
          where.created_at.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.created_at.lte = filters.dateTo;
        }
      }

      if (filters.model) {
        where.event_data = {
          path: ['model'],
          equals: filters.model
        };
      }

      const logs = await prisma.analytics.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          users: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          conversations: {
            select: {
              title: true,
              mode: true
            }
          }
        }
      });

      return logs;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to fetch query logs:', error);
      throw new Error('Failed to fetch query logs');
    }
  }

  /**
   * Get query statistics for a user
   */
  static async getUserQueryStats(userId: string, days: number = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const stats = await prisma.analytics.aggregate({
        where: {
          user_id: userId,
          event_type: 'query_interaction',
          created_at: {
            gte: since
          }
        },
        _count: true,
        _avg: {
          duration: true
        },
        _sum: {
          duration: true
        }
      });

      // Get query distribution by model
      const modelStats = await prisma.analytics.groupBy({
        by: ['event_data'],
        where: {
          user_id: userId,
          event_type: 'query_interaction',
          created_at: {
            gte: since
          }
        },
        _count: true
      });

      // Get daily query counts
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as query_count,
          AVG(duration) as avg_duration
        FROM analytics 
        WHERE user_id = ${userId} 
          AND event_type = 'query_interaction'
          AND created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      return {
        total_queries: stats._count,
        avg_duration: stats._avg.duration || 0,
        total_duration: stats._sum.duration || 0,
        period_days: days,
        daily_stats: dailyStats,
        model_distribution: modelStats
      };
    } catch (error) {
      console.error('[QUERY_LOG] Failed to get user stats:', error);
      throw new Error('Failed to get user query statistics');
    }
  }

  /**
   * Get top queries for analysis
   */
  static async getTopQueries(userId?: string, limit: number = 10) {
    try {
      const where: any = {
        event_type: 'query_interaction'
      };

      if (userId) {
        where.user_id = userId;
      }

      const logs = await prisma.analytics.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          event_data: true,
          created_at: true,
          duration: true,
          users: {
            select: {
              email: true
            }
          }
        }
      });

      return logs.map(log => ({
        query: log.event_data?.query || '',
        response_preview: log.event_data?.response?.substring(0, 100) + '...',
        user_email: log.users.email,
        duration: log.duration,
        timestamp: log.created_at
      }));
    } catch (error) {
      console.error('[QUERY_LOG] Failed to get top queries:', error);
      throw new Error('Failed to get top queries');
    }
  }

  /**
   * Delete old query logs (cleanup)
   */
  static async cleanupOldLogs(daysToKeep: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await prisma.analytics.deleteMany({
        where: {
          event_type: 'query_interaction',
          created_at: {
            lt: cutoffDate
          }
        }
      });

      console.log(`[QUERY_LOG] Cleaned up ${deleted.count} old query logs`);
      return deleted.count;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to cleanup old logs:', error);
      throw new Error('Failed to cleanup old query logs');
    }
  }

  /**
   * Search queries by content
   */
  static async searchQueries(searchTerm: string, userId?: string, limit: number = 20) {
    try {
      const where: any = {
        event_type: 'query_interaction',
        OR: [
          {
            event_data: {
              path: ['query'],
              string_contains: searchTerm
            }
          },
          {
            event_data: {
              path: ['response'],
              string_contains: searchTerm
            }
          }
        ]
      };

      if (userId) {
        where.user_id = userId;
      }

      const results = await prisma.analytics.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        include: {
          users: {
            select: {
              email: true,
              firstName: true
            }
          }
        }
      });

      return results;
    } catch (error) {
      console.error('[QUERY_LOG] Failed to search queries:', error);
      throw new Error('Failed to search queries');
    }
  }
}

export default QueryLogger;