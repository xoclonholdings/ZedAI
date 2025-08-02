"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.registerRoutes = registerRoutes;
var http_1 = require("http");
var storage_1 = require("./storage");
var openai_1 = require("./services/openai");
var localAuth_1 = require("./localAuth");
var queryLogger_1 = require("./services/queryLogger");
var schema_1 = require("@shared/schema");
var express_1 = require("express");
var memory_1 = require("./routes/memory");
var zedMemory_1 = require("./routes/zedMemory");
// Helper for admin check
function isAdminUser(sessionUser) {
    return (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.username) === 'Admin' || (sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.email) === 'admin@zed.local';
}
function registerRoutes(app) {
    return __awaiter(this, void 0, void 0, function () {
        // Julius API helper function
        function callJuliusAPI(content) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // TODO: Replace with actual Julius API integration
                    // For now, return a fallback response
                    console.log("🔄 ZED: Using Julius fallback...");
                    // Example Julius API call (replace with actual implementation)
                    try {
                        // const juliusResponse = await fetch('http://your-julius-api/generate', {
                        //   method: 'POST',
                        //   headers: { 'Content-Type': 'application/json' },
                        //   body: JSON.stringify({ prompt: content })
                        // });
                        // const data = await juliusResponse.json();
                        // return data.response;
                        // Temporary fallback response
                        return [2 /*return*/, "I understand you're asking: \"".concat(content.substring(0, 100)).concat(content.length > 100 ? '...' : '', "\". I'm currently running on backup systems and may have limited capabilities. Please try again for a more detailed response.")];
                    }
                    catch (error) {
                        throw new Error("Julius API unavailable");
                    }
                    return [2 /*return*/];
                });
            });
        }
        var router, httpServer;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, localAuth_1.setupLocalAuth)(app)];
                case 1:
                    _a.sent();
                    // POST: Log user interaction with ZED
                    app.post("/api/log", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, prompt_1, response, metadata, PrismaClient, prisma_1, logEntry, error_1;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 7, , 8]);
                                    userId = (_b = req.session.user) === null || _b === void 0 ? void 0 : _b.id;
                                    _a = req.body, prompt_1 = _a.prompt, response = _a.response, metadata = _a.metadata;
                                    if (!prompt_1 || !response) {
                                        return [2 /*return*/, res.status(400).json({ error: "Both prompt and response are required" })];
                                    }
                                    if (!userId) {
                                        return [2 /*return*/, res.status(401).json({ error: "User not authenticated" })];
                                    }
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@prisma/client"); })];
                                case 1:
                                    PrismaClient = (_c.sent()).PrismaClient;
                                    prisma_1 = new PrismaClient();
                                    _c.label = 2;
                                case 2:
                                    _c.trys.push([2, , 4, 6]);
                                    return [4 /*yield*/, prisma_1.interaction_log.create({
                                            data: {
                                                user_id: userId,
                                                prompt: prompt_1.toString(),
                                                response: response.toString(),
                                                metadata: metadata || {},
                                                timestamp: new Date()
                                            }
                                        })];
                                case 3:
                                    logEntry = _c.sent();
                                    res.status(201).json({
                                        success: true,
                                        logId: logEntry.id,
                                        timestamp: logEntry.timestamp,
                                        message: "Interaction logged successfully"
                                    });
                                    return [3 /*break*/, 6];
                                case 4: return [4 /*yield*/, prisma_1.$disconnect()];
                                case 5:
                                    _c.sent();
                                    return [7 /*endfinally*/];
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    error_1 = _c.sent();
                                    res.status(500).json({ error: "Failed to log interaction" });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); });
                    // GET: Fetch interaction history for specific user
                    app.get("/api/logs/:userId", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var requestedUserId, sessionUserId, _a, _b, limit, _c, offset, dateFrom, dateTo, sessionUser, PrismaClient, prisma_2, whereClause, logs, totalCount, formattedLogs, error_2;
                        var _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 8, , 9]);
                                    requestedUserId = req.params.userId;
                                    sessionUserId = (_d = req.session.user) === null || _d === void 0 ? void 0 : _d.id;
                                    _a = req.query, _b = _a.limit, limit = _b === void 0 ? 50 : _b, _c = _a.offset, offset = _c === void 0 ? 0 : _c, dateFrom = _a.dateFrom, dateTo = _a.dateTo;
                                    sessionUser = req.session.user;
                                    if (!isAdminUser(sessionUser) && requestedUserId !== sessionUserId) {
                                        return [2 /*return*/, res.status(403).json({ error: "Access denied. You can only view your own interaction logs" })];
                                    }
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@prisma/client"); })];
                                case 1:
                                    PrismaClient = (_e.sent()).PrismaClient;
                                    prisma_2 = new PrismaClient();
                                    _e.label = 2;
                                case 2:
                                    _e.trys.push([2, , 5, 7]);
                                    whereClause = { user_id: requestedUserId };
                                    if (dateFrom || dateTo) {
                                        whereClause.timestamp = {};
                                        if (dateFrom)
                                            whereClause.timestamp.gte = new Date(dateFrom);
                                        if (dateTo)
                                            whereClause.timestamp.lte = new Date(dateTo);
                                    }
                                    return [4 /*yield*/, prisma_2.interaction_log.findMany({
                                            where: whereClause,
                                            orderBy: { timestamp: 'desc' },
                                            take: parseInt(limit),
                                            skip: parseInt(offset),
                                            include: {
                                                users: {
                                                    select: { email: true, firstName: true, lastName: true }
                                                }
                                            }
                                        })];
                                case 3:
                                    logs = _e.sent();
                                    return [4 /*yield*/, prisma_2.interaction_log.count({ where: whereClause })];
                                case 4:
                                    totalCount = _e.sent();
                                    formattedLogs = logs.map(function (log) {
                                        var _a, _b, _c;
                                        return ({
                                            id: log.id,
                                            prompt: log.prompt,
                                            response: log.response,
                                            timestamp: log.timestamp,
                                            metadata: log.metadata,
                                            user: {
                                                email: (_a = log.users) === null || _a === void 0 ? void 0 : _a.email,
                                                name: "".concat(((_b = log.users) === null || _b === void 0 ? void 0 : _b.firstName) || '', " ").concat(((_c = log.users) === null || _c === void 0 ? void 0 : _c.lastName) || '').trim()
                                            }
                                        });
                                    });
                                    res.json({
                                        success: true,
                                        userId: requestedUserId,
                                        logs: formattedLogs,
                                        pagination: {
                                            total: totalCount,
                                            limit: parseInt(limit),
                                            offset: parseInt(offset),
                                            hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
                                        },
                                        filters: { dateFrom: dateFrom, dateTo: dateTo }
                                    });
                                    return [3 /*break*/, 7];
                                case 5: return [4 /*yield*/, prisma_2.$disconnect()];
                                case 6:
                                    _e.sent();
                                    return [7 /*endfinally*/];
                                case 7: return [3 /*break*/, 9];
                                case 8:
                                    error_2 = _e.sent();
                                    res.status(500).json({ error: "Failed to fetch interaction logs" });
                                    return [3 /*break*/, 9];
                                case 9: return [2 /*return*/];
                            }
                        });
                    }); });
                    // GET: Get interaction statistics for user (admin dashboard)
                    app.get("/api/logs/:userId/stats", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var requestedUserId, sessionUserId, _a, days, sessionUser, PrismaClient, prisma_3, since, totalInteractions, dailyStats, recentPrompts, error_3;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 9, , 10]);
                                    requestedUserId = req.params.userId;
                                    sessionUserId = (_b = req.session.user) === null || _b === void 0 ? void 0 : _b.id;
                                    _a = req.query.days, days = _a === void 0 ? 30 : _a;
                                    sessionUser = req.session.user;
                                    if (!isAdminUser(sessionUser) && requestedUserId !== sessionUserId) {
                                        return [2 /*return*/, res.status(403).json({ error: "Access denied. You can only view your own statistics" })];
                                    }
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@prisma/client"); })];
                                case 1:
                                    PrismaClient = (_c.sent()).PrismaClient;
                                    prisma_3 = new PrismaClient();
                                    _c.label = 2;
                                case 2:
                                    _c.trys.push([2, , 6, 8]);
                                    since = new Date();
                                    since.setDate(since.getDate() - parseInt(days));
                                    return [4 /*yield*/, prisma_3.interaction_log.count({
                                            where: { user_id: requestedUserId, timestamp: { gte: since } }
                                        })];
                                case 3:
                                    totalInteractions = _c.sent();
                                    return [4 /*yield*/, prisma_3.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          SELECT \n            DATE(timestamp) as date,\n            COUNT(*) as interaction_count,\n            AVG(LENGTH(prompt)) as avg_prompt_length,\n            AVG(LENGTH(response)) as avg_response_length\n          FROM interaction_log \n          WHERE user_id = ", "\n            AND timestamp >= ", "\n          GROUP BY DATE(timestamp)\n          ORDER BY date DESC\n        "], ["\n          SELECT \n            DATE(timestamp) as date,\n            COUNT(*) as interaction_count,\n            AVG(LENGTH(prompt)) as avg_prompt_length,\n            AVG(LENGTH(response)) as avg_response_length\n          FROM interaction_log \n          WHERE user_id = ", "\n            AND timestamp >= ", "\n          GROUP BY DATE(timestamp)\n          ORDER BY date DESC\n        "])), requestedUserId, since)];
                                case 4:
                                    dailyStats = _c.sent();
                                    return [4 /*yield*/, prisma_3.interaction_log.findMany({
                                            where: { user_id: requestedUserId, timestamp: { gte: since } },
                                            select: { prompt: true, timestamp: true },
                                            orderBy: { timestamp: 'desc' },
                                            take: 10
                                        })];
                                case 5:
                                    recentPrompts = _c.sent();
                                    res.json({
                                        success: true,
                                        userId: requestedUserId,
                                        period_days: parseInt(days),
                                        statistics: {
                                            total_interactions: totalInteractions,
                                            daily_breakdown: dailyStats,
                                            recent_prompts: recentPrompts.map(function (p) { return ({
                                                prompt: p.prompt.substring(0, 100) + (p.prompt.length > 100 ? '...' : ''),
                                                timestamp: p.timestamp
                                            }); })
                                        }
                                    });
                                    return [3 /*break*/, 8];
                                case 6: return [4 /*yield*/, prisma_3.$disconnect()];
                                case 7:
                                    _c.sent();
                                    return [7 /*endfinally*/];
                                case 8: return [3 /*break*/, 10];
                                case 9:
                                    error_3 = _c.sent();
                                    res.status(500).json({ error: "Failed to fetch interaction statistics" });
                                    return [3 /*break*/, 10];
                                case 10: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Conversation routes
                    // Get all conversations for the current user
                    app.get("/api/conversations", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var mockConversations;
                        return __generator(this, function (_a) {
                            try {
                                // Skip authentication for development - return mock conversations
                                console.log("📋 GET Conversations (dev mode)");
                                mockConversations = [
                                    {
                                        id: "conv-1",
                                        title: "Welcome to ZED",
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                        userId: "dev-user"
                                    }
                                ];
                                console.log("📁 Returning mock conversations:", mockConversations.length);
                                return [2 /*return*/, res.json(mockConversations)];
                            }
                            catch (error) {
                                console.error("❌ Error fetching conversations:", error);
                                return [2 /*return*/, res.status(500).json({ error: "Failed to fetch conversations" })];
                            }
                            return [2 /*return*/];
                        });
                    }); });
                    // Get a specific conversation
                    app.get("/api/conversations/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, mockConversation;
                        return __generator(this, function (_a) {
                            try {
                                conversationId = req.params.id;
                                console.log("📄 GET Conversation:", conversationId);
                                mockConversation = {
                                    id: conversationId,
                                    title: "Mock Conversation",
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    userId: "dev-user"
                                };
                                return [2 /*return*/, res.json(mockConversation)];
                            }
                            catch (error) {
                                console.error("❌ Error fetching conversation:", error);
                                return [2 /*return*/, res.status(500).json({ error: "Failed to fetch conversation" })];
                            }
                            return [2 /*return*/];
                        });
                    }); });
                    // Create a new conversation
                    app.post("/api/conversations", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var userId, _a, _b, title, _c, mode, conversationData, conversation, error_4;
                        var _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 2, , 3]);
                                    userId = (_d = req.session.user) === null || _d === void 0 ? void 0 : _d.id;
                                    _a = req.body, _b = _a.title, title = _b === void 0 ? "New Conversation" : _b, _c = _a.mode, mode = _c === void 0 ? "chat" : _c;
                                    console.log("➕ POST Create conversation for user:", userId, "title:", title);
                                    conversationData = schema_1.insertConversationSchema.parse({
                                        userId: userId,
                                        title: title,
                                        mode: mode,
                                        preview: title.substring(0, 100)
                                    });
                                    return [4 /*yield*/, storage_1.storage.createConversation(conversationData)];
                                case 1:
                                    conversation = _e.sent();
                                    console.log("✅ Created conversation:", conversation.id);
                                    return [2 /*return*/, res.json(conversation)];
                                case 2:
                                    error_4 = _e.sent();
                                    console.error("❌ Error creating conversation:", error_4);
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to create conversation" })];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Update a conversation
                    app.patch("/api/conversations/:id", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, updates, conversation, error_5;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    conversationId = req.params.id;
                                    updates = req.body;
                                    console.log("🔄 PATCH Update conversation:", conversationId, "updates:", updates);
                                    return [4 /*yield*/, storage_1.storage.updateConversation(conversationId, updates)];
                                case 1:
                                    conversation = _a.sent();
                                    if (!conversation) {
                                        return [2 /*return*/, res.status(404).json({ error: "Conversation not found" })];
                                    }
                                    return [2 /*return*/, res.json(conversation)];
                                case 2:
                                    error_5 = _a.sent();
                                    console.error("❌ Error updating conversation:", error_5);
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to update conversation" })];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Delete a conversation
                    app.delete("/api/conversations/:id", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, success, error_6;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    conversationId = req.params.id;
                                    console.log("🗑️ DELETE Conversation:", conversationId);
                                    return [4 /*yield*/, storage_1.storage.deleteConversation(conversationId)];
                                case 1:
                                    success = _a.sent();
                                    if (!success) {
                                        return [2 /*return*/, res.status(404).json({ error: "Conversation not found" })];
                                    }
                                    return [2 /*return*/, res.json({ success: true })];
                                case 2:
                                    error_6 = _a.sent();
                                    console.error("❌ Error deleting conversation:", error_6);
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to delete conversation" })];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get messages for a conversation
                    app.get("/api/conversations/:id/messages", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, messages, error_7;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    conversationId = req.params.id;
                                    console.log("📥 GET Messages request for conversation:", conversationId);
                                    return [4 /*yield*/, storage_1.storage.getMessagesByConversation(conversationId)];
                                case 1:
                                    messages = _a.sent();
                                    console.log("📋 Found messages:", messages.length);
                                    return [2 /*return*/, res.json(messages)];
                                case 2:
                                    error_7 = _a.sent();
                                    console.error("❌ Error fetching messages:", error_7);
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to fetch messages" })];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Get files for a conversation
                    app.get("/api/conversations/:id/files", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, files, error_8;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    conversationId = req.params.id;
                                    console.log("📁 GET Files for conversation:", conversationId);
                                    return [4 /*yield*/, storage_1.storage.getFilesByConversation(conversationId)];
                                case 1:
                                    files = _a.sent();
                                    console.log("📄 Found files:", files.length);
                                    return [2 /*return*/, res.json(files)];
                                case 2:
                                    error_8 = _a.sent();
                                    console.error("❌ Error fetching files:", error_8);
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to fetch files" })];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Send message and get AI response
                    app.post("/api/conversations/:id/messages", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var conversationId, _a, content, _b, role, userMessageData, userMessage, messages, chatHistory, conversation, conversationMode, userContext, aiResponse, aiMessageData, aiMessage, title, error_9, error_10;
                        var _c, _d, _e;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    _f.trys.push([0, 11, , 12]);
                                    conversationId = req.params.id;
                                    _a = req.body, content = _a.content, _b = _a.role, role = _b === void 0 ? "user" : _b;
                                    if (!content) {
                                        return [2 /*return*/, res.status(400).json({ error: "Message content is required" })];
                                    }
                                    userMessageData = schema_1.insertMessageSchema.parse({ conversationId: conversationId, role: role, content: content });
                                    return [4 /*yield*/, storage_1.storage.createMessage(userMessageData)];
                                case 1:
                                    userMessage = _f.sent();
                                    return [4 /*yield*/, storage_1.storage.getMessagesByConversation(conversationId)];
                                case 2:
                                    messages = _f.sent();
                                    chatHistory = messages.map(function (msg) { return ({
                                        role: msg.role,
                                        content: msg.content
                                    }); });
                                    return [4 /*yield*/, storage_1.storage.getConversation(conversationId)];
                                case 3:
                                    conversation = _f.sent();
                                    conversationMode = (conversation === null || conversation === void 0 ? void 0 : conversation.mode) || "chat";
                                    userContext = {
                                        userId: ((_c = req.session.user) === null || _c === void 0 ? void 0 : _c.id) || 'anonymous',
                                        accessLevel: isAdminUser(req.session.user) ? 'admin' : 'user',
                                        personalityMode: ((_d = req.session.user) === null || _d === void 0 ? void 0 : _d.personalityMode) || 'standard',
                                        preferences: ((_e = req.session.user) === null || _e === void 0 ? void 0 : _e.preferences) || {}
                                    };
                                    _f.label = 4;
                                case 4:
                                    _f.trys.push([4, 9, , 10]);
                                    return [4 /*yield*/, (0, openai_1.generateChatResponse)(chatHistory, conversationMode, "gpt-4o", userContext)];
                                case 5:
                                    aiResponse = _f.sent();
                                    aiMessageData = schema_1.insertMessageSchema.parse({
                                        conversationId: conversationId,
                                        role: "assistant",
                                        content: aiResponse
                                    });
                                    return [4 /*yield*/, storage_1.storage.createMessage(aiMessageData)];
                                case 6:
                                    aiMessage = _f.sent();
                                    if (!(messages.length <= 2)) return [3 /*break*/, 8];
                                    title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
                                    return [4 /*yield*/, storage_1.storage.updateConversation(conversationId, {
                                            title: title,
                                            preview: aiResponse.slice(0, 100) + (aiResponse.length > 100 ? "..." : "")
                                        })];
                                case 7:
                                    _f.sent();
                                    _f.label = 8;
                                case 8: return [2 /*return*/, res.json({ userMessage: userMessage, aiMessage: aiMessage })];
                                case 9:
                                    error_9 = _f.sent();
                                    return [2 /*return*/, res.status(500).json({ error: "AI response unavailable. Please try again later or contact support." })];
                                case 10: return [3 /*break*/, 12];
                                case 11:
                                    error_10 = _f.sent();
                                    return [2 /*return*/, res.status(500).json({ error: "Failed to process message" })];
                                case 12: return [2 /*return*/];
                            }
                        });
                    }); });
                    // POST: /api/ask - AI question answering endpoint
                    app.post("/api/ask", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, content, prompt_2, model, stream, userInput, userId, response, modelUsed, openaiResponse, openaiError_1, logError_1, error_11;
                        var _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 9, , 10]);
                                    _a = req.body, content = _a.content, prompt_2 = _a.prompt, model = _a.model, stream = _a.stream;
                                    userInput = content || prompt_2;
                                    if (!userInput) {
                                        return [2 /*return*/, res.status(400).json({ error: "Content or prompt is required" })];
                                    }
                                    console.log("🤖 ZED: Processing user request with fallback chain");
                                    userId = (_c = (_b = req.session) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id;
                                    response = void 0;
                                    modelUsed = 'unknown';
                                    _d.label = 1;
                                case 1:
                                    _d.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, (0, openai_1.generateChatResponse)([
                                            { role: "user", content: userInput }
                                        ], model || "chat")];
                                case 2:
                                    openaiResponse = _d.sent();
                                    if (openaiResponse && openaiResponse.trim()) {
                                        response = openaiResponse.trim();
                                        modelUsed = 'openai';
                                        console.log("✅ ZED: OpenAI responded successfully");
                                    }
                                    else {
                                        throw new Error("Empty response from OpenAI");
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    openaiError_1 = _d.sent();
                                    console.log("⚠️ ZED: OpenAI failed, using fallback...", openaiError_1 instanceof Error ? openaiError_1.message : String(openaiError_1));
                                    // Simple fallback response
                                    response = "I understand you're asking: \"".concat(userInput.substring(0, 100)).concat(userInput.length > 100 ? '...' : '', "\". I'm currently running on backup systems and may have limited capabilities. Please try again for a more detailed response.");
                                    modelUsed = 'fallback';
                                    return [3 /*break*/, 4];
                                case 4:
                                    if (!(userId && response)) return [3 /*break*/, 8];
                                    _d.label = 5;
                                case 5:
                                    _d.trys.push([5, 7, , 8]);
                                    return [4 /*yield*/, queryLogger_1.QueryLogger.logQuery({
                                            userId: userId,
                                            query: userInput,
                                            response: response,
                                            model: modelUsed,
                                            metadata: {
                                                source: 'zed-unified',
                                                fallback_used: modelUsed !== 'openai'
                                            }
                                        })];
                                case 6:
                                    _d.sent();
                                    return [3 /*break*/, 8];
                                case 7:
                                    logError_1 = _d.sent();
                                    console.warn("⚠️ Failed to log interaction:", logError_1);
                                    return [3 /*break*/, 8];
                                case 8: 
                                // Return unified ZED response
                                return [2 /*return*/, res.json({
                                        response: response,
                                        answer: response, // For backward compatibility
                                        assistant: "ZED",
                                        success: true
                                    })];
                                case 9:
                                    error_11 = _d.sent();
                                    console.error("❌ ZED: Critical error in ask endpoint:", error_11);
                                    return [2 /*return*/, res.status(500).json({
                                            error: "ZED is temporarily offline. Please try again.",
                                            assistant: "ZED"
                                        })];
                                case 10: return [2 /*return*/];
                            }
                        });
                    }); });
                    router = (0, express_1.Router)();
                    // POST: Unified ZED AI endpoint with fallback chain
                    app.post("/api/ask", localAuth_1.isAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var content, userId, response, modelUsed, ollamaResponse, data, ollamaError_1, openaiResponse, openaiError_2, juliusError_1, logError_2, error_12;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 20, , 21]);
                                    content = req.body.content;
                                    if (!content) {
                                        return [2 /*return*/, res.status(400).json({ error: "Content is required" })];
                                    }
                                    console.log("� ZED: Processing user request with fallback chain");
                                    userId = (_a = req.session.user) === null || _a === void 0 ? void 0 : _a.id;
                                    response = void 0;
                                    modelUsed = 'unknown';
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 6, , 15]);
                                    console.log("🤖 ZED: Attempting Ollama (local model)...");
                                    return [4 /*yield*/, fetch('http://localhost:11434/api/generate', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                model: 'phi', // or 'tinyllama' based on what's available
                                                prompt: content,
                                                stream: false
                                            }),
                                            signal: AbortSignal.timeout(30000) // 30 second timeout
                                        })];
                                case 2:
                                    ollamaResponse = _b.sent();
                                    if (!ollamaResponse.ok) return [3 /*break*/, 4];
                                    return [4 /*yield*/, ollamaResponse.json()];
                                case 3:
                                    data = _b.sent();
                                    if (data.response && data.response.trim()) {
                                        response = data.response.trim();
                                        modelUsed = 'ollama';
                                        console.log("✅ ZED: Ollama responded successfully");
                                    }
                                    else {
                                        throw new Error("Empty response from Ollama");
                                    }
                                    return [3 /*break*/, 5];
                                case 4: throw new Error("Ollama HTTP ".concat(ollamaResponse.status));
                                case 5: return [3 /*break*/, 15];
                                case 6:
                                    ollamaError_1 = _b.sent();
                                    console.log("⚠️ ZED: Ollama failed, trying OpenAI...", ollamaError_1 instanceof Error ? ollamaError_1.message : String(ollamaError_1));
                                    _b.label = 7;
                                case 7:
                                    _b.trys.push([7, 9, , 14]);
                                    return [4 /*yield*/, (0, openai_1.generateChatResponse)([
                                            { role: "user", content: content }
                                        ], "chat", "gpt-4")];
                                case 8:
                                    openaiResponse = _b.sent();
                                    if (openaiResponse && openaiResponse.trim()) {
                                        response = openaiResponse.trim();
                                        modelUsed = 'openai';
                                        console.log("✅ ZED: OpenAI responded successfully");
                                    }
                                    else {
                                        throw new Error("Empty response from OpenAI");
                                    }
                                    return [3 /*break*/, 14];
                                case 9:
                                    openaiError_2 = _b.sent();
                                    console.log("⚠️ ZED: OpenAI failed, trying Julius...", openaiError_2 instanceof Error ? openaiError_2.message : String(openaiError_2));
                                    _b.label = 10;
                                case 10:
                                    _b.trys.push([10, 12, , 13]);
                                    return [4 /*yield*/, callJuliusAPI(content)];
                                case 11:
                                    // TODO: Implement Julius API call
                                    // For now, using a simple fallback response
                                    response = _b.sent();
                                    modelUsed = 'julius';
                                    console.log("✅ ZED: Julius responded successfully");
                                    return [3 /*break*/, 13];
                                case 12:
                                    juliusError_1 = _b.sent();
                                    console.error("❌ ZED: All models failed", juliusError_1 instanceof Error ? juliusError_1.message : String(juliusError_1));
                                    return [2 /*return*/, res.status(503).json({
                                            error: "ZED is temporarily offline. Please try again.",
                                            assistant: "ZED"
                                        })];
                                case 13: return [3 /*break*/, 14];
                                case 14: return [3 /*break*/, 15];
                                case 15:
                                    if (!(userId && response)) return [3 /*break*/, 19];
                                    _b.label = 16;
                                case 16:
                                    _b.trys.push([16, 18, , 19]);
                                    return [4 /*yield*/, queryLogger_1.QueryLogger.logQuery({
                                            userId: userId,
                                            query: content,
                                            response: response,
                                            model: modelUsed,
                                            metadata: {
                                                source: 'zed-unified',
                                                fallback_used: modelUsed !== 'ollama'
                                            }
                                        })];
                                case 17:
                                    _b.sent();
                                    return [3 /*break*/, 19];
                                case 18:
                                    logError_2 = _b.sent();
                                    console.warn("⚠️ Failed to log interaction:", logError_2);
                                    return [3 /*break*/, 19];
                                case 19:
                                    // Return unified ZED response
                                    res.json({
                                        response: response,
                                        assistant: "ZED",
                                        success: true
                                    });
                                    return [3 /*break*/, 21];
                                case 20:
                                    error_12 = _b.sent();
                                    console.error("❌ ZED: Critical error in ask endpoint:", error_12);
                                    res.status(500).json({
                                        error: "ZED is temporarily offline. Please try again.",
                                        assistant: "ZED"
                                    });
                                    return [3 /*break*/, 21];
                                case 21: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Memory management routes (Admin only)
                    app.use('/api/memory', memory_1.default);
                    // ZED Core Memory System routes
                    app.use('/api/zed/memory', zedMemory_1.default);
                    // Only add API-specific 404 handling, not global
                    app.use('/api/*', function (req, res) {
                        res.status(404).json({ error: "API endpoint not found" });
                    });
                    // Middleware to handle errors
                    app.use(function (err, req, res, next) {
                        res.status(500).json({ error: "Internal Server Error" });
                    });
                    httpServer = (0, http_1.createServer)(app);
                    return [2 /*return*/, httpServer];
            }
        });
    });
}
var templateObject_1;
