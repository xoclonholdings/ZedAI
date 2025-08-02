"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryLogger = void 0;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var nanoid_1 = require("nanoid");
var QueryLogger = /** @class */ (function () {
    function QueryLogger() {
    }
    /**
     * Log a new query-response interaction
     */
    QueryLogger.logQuery = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var logEntry, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.analytics.create({
                                data: {
                                    id: (0, nanoid_1.nanoid)(),
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
                                    metadata: __assign(__assign({}, data.metadata), { logged_at: new Date().toISOString(), zed_version: '1.0.0' }),
                                }
                            })];
                    case 1:
                        logEntry = _a.sent();
                        console.log("[QUERY_LOG] Logged interaction for user ".concat(data.userId));
                        return [2 /*return*/, logEntry];
                    case 2:
                        error_1 = _a.sent();
                        console.error('[QUERY_LOG] Failed to log query:', error_1);
                        throw new Error('Failed to log query interaction');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get query logs with filtering
     */
    QueryLogger.getQueryLogs = function () {
        return __awaiter(this, arguments, void 0, function (filters) {
            var where, logs, error_2;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        where = {
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
                        return [4 /*yield*/, prisma.analytics.findMany({
                                where: where,
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
                            })];
                    case 1:
                        logs = _a.sent();
                        return [2 /*return*/, logs];
                    case 2:
                        error_2 = _a.sent();
                        console.error('[QUERY_LOG] Failed to fetch query logs:', error_2);
                        throw new Error('Failed to fetch query logs');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get query statistics for a user
     */
    QueryLogger.getUserQueryStats = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, days) {
            var since, stats, modelStats, dailyStats, error_3;
            if (days === void 0) { days = 30; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        since = new Date();
                        since.setDate(since.getDate() - days);
                        return [4 /*yield*/, prisma.analytics.aggregate({
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
                            })];
                    case 1:
                        stats = _a.sent();
                        return [4 /*yield*/, prisma.analytics.groupBy({
                                by: ['event_data'],
                                where: {
                                    user_id: userId,
                                    event_type: 'query_interaction',
                                    created_at: {
                                        gte: since
                                    }
                                },
                                _count: true
                            })];
                    case 2:
                        modelStats = _a.sent();
                        return [4 /*yield*/, prisma.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        SELECT \n          DATE(created_at) as date,\n          COUNT(*) as query_count,\n          AVG(duration) as avg_duration\n        FROM analytics \n        WHERE user_id = ", " \n          AND event_type = 'query_interaction'\n          AND created_at >= ", "\n        GROUP BY DATE(created_at)\n        ORDER BY date DESC\n      "], ["\n        SELECT \n          DATE(created_at) as date,\n          COUNT(*) as query_count,\n          AVG(duration) as avg_duration\n        FROM analytics \n        WHERE user_id = ", " \n          AND event_type = 'query_interaction'\n          AND created_at >= ", "\n        GROUP BY DATE(created_at)\n        ORDER BY date DESC\n      "])), userId, since)];
                    case 3:
                        dailyStats = _a.sent();
                        return [2 /*return*/, {
                                total_queries: stats._count,
                                avg_duration: stats._avg.duration || 0,
                                total_duration: stats._sum.duration || 0,
                                period_days: days,
                                daily_stats: dailyStats,
                                model_distribution: modelStats
                            }];
                    case 4:
                        error_3 = _a.sent();
                        console.error('[QUERY_LOG] Failed to get user stats:', error_3);
                        throw new Error('Failed to get user query statistics');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get top queries for analysis
     */
    QueryLogger.getTopQueries = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, limit) {
            var where, logs, error_4;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        where = {
                            event_type: 'query_interaction'
                        };
                        if (userId) {
                            where.user_id = userId;
                        }
                        return [4 /*yield*/, prisma.analytics.findMany({
                                where: where,
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
                            })];
                    case 1:
                        logs = _a.sent();
                        return [2 /*return*/, logs.map(function (log) {
                                var _a, _b, _c;
                                return ({
                                    query: ((_a = log.event_data) === null || _a === void 0 ? void 0 : _a.query) || '',
                                    response_preview: ((_c = (_b = log.event_data) === null || _b === void 0 ? void 0 : _b.response) === null || _c === void 0 ? void 0 : _c.substring(0, 100)) + '...',
                                    user_email: log.users.email,
                                    duration: log.duration,
                                    timestamp: log.created_at
                                });
                            })];
                    case 2:
                        error_4 = _a.sent();
                        console.error('[QUERY_LOG] Failed to get top queries:', error_4);
                        throw new Error('Failed to get top queries');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete old query logs (cleanup)
     */
    QueryLogger.cleanupOldLogs = function () {
        return __awaiter(this, arguments, void 0, function (daysToKeep) {
            var cutoffDate, deleted, error_5;
            if (daysToKeep === void 0) { daysToKeep = 90; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
                        return [4 /*yield*/, prisma.analytics.deleteMany({
                                where: {
                                    event_type: 'query_interaction',
                                    created_at: {
                                        lt: cutoffDate
                                    }
                                }
                            })];
                    case 1:
                        deleted = _a.sent();
                        console.log("[QUERY_LOG] Cleaned up ".concat(deleted.count, " old query logs"));
                        return [2 /*return*/, deleted.count];
                    case 2:
                        error_5 = _a.sent();
                        console.error('[QUERY_LOG] Failed to cleanup old logs:', error_5);
                        throw new Error('Failed to cleanup old query logs');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Search queries by content
     */
    QueryLogger.searchQueries = function (searchTerm_1, userId_1) {
        return __awaiter(this, arguments, void 0, function (searchTerm, userId, limit) {
            var where, results, error_6;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        where = {
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
                        return [4 /*yield*/, prisma.analytics.findMany({
                                where: where,
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
                            })];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, results];
                    case 2:
                        error_6 = _a.sent();
                        console.error('[QUERY_LOG] Failed to search queries:', error_6);
                        throw new Error('Failed to search queries');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return QueryLogger;
}());
exports.QueryLogger = QueryLogger;
exports.default = QueryLogger;
var templateObject_1;
