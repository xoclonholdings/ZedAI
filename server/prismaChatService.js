"use strict";
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
exports.PrismaChatService = void 0;
var prisma_1 = require("./prisma");
var nanoid_1 = require("nanoid");
// Chat service using Prisma for database operations
var PrismaChatService = /** @class */ (function () {
    function PrismaChatService() {
    }
    // Get all conversations for a user
    PrismaChatService.getConversations = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var conversations, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.conversation.findMany({
                                where: { userId: userId },
                                orderBy: { updatedAt: 'desc' },
                            })];
                    case 1:
                        conversations = _a.sent();
                        return [2 /*return*/, conversations];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error fetching conversations:', error_1);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get a specific conversation
    PrismaChatService.getConversation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.conversation.findUnique({
                                where: { id: id },
                            })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error fetching conversation:', error_2);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Create a new conversation
    PrismaChatService.createConversation = function (userId_1, title_1) {
        return __awaiter(this, arguments, void 0, function (userId, title, mode) {
            var conversation, error_3;
            if (mode === void 0) { mode = 'chat'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.conversation.create({
                                data: {
                                    id: (0, nanoid_1.nanoid)(),
                                    userId: userId,
                                    title: title,
                                    mode: mode,
                                    preview: title.substring(0, 100),
                                },
                            })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error creating conversation:', error_3);
                        throw new Error('Failed to create conversation');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Update a conversation
    PrismaChatService.updateConversation = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.conversation.update({
                                where: { id: id },
                                data: __assign(__assign({}, updates), { updatedAt: new Date() }),
                            })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Error updating conversation:', error_4);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Delete a conversation
    PrismaChatService.deleteConversation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        // First delete associated messages and files
                        return [4 /*yield*/, prisma_1.prisma.message.deleteMany({
                                where: { conversationId: id },
                            })];
                    case 1:
                        // First delete associated messages and files
                        _a.sent();
                        return [4 /*yield*/, prisma_1.prisma.file.deleteMany({
                                where: { conversationId: id },
                            })];
                    case 2:
                        _a.sent();
                        // Then delete the conversation
                        return [4 /*yield*/, prisma_1.prisma.conversation.delete({
                                where: { id: id },
                            })];
                    case 3:
                        // Then delete the conversation
                        _a.sent();
                        return [2 /*return*/, true];
                    case 4:
                        error_5 = _a.sent();
                        console.error('Error deleting conversation:', error_5);
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Get messages for a conversation
    PrismaChatService.getMessages = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var messages, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.message.findMany({
                                where: { conversationId: conversationId },
                                orderBy: { createdAt: 'asc' },
                            })];
                    case 1:
                        messages = _a.sent();
                        return [2 /*return*/, messages];
                    case 2:
                        error_6 = _a.sent();
                        console.error('Error fetching messages:', error_6);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Create a new message
    PrismaChatService.createMessage = function (conversationId, role, content, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var message, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma_1.prisma.message.create({
                                data: {
                                    id: (0, nanoid_1.nanoid)(),
                                    conversationId: conversationId,
                                    role: role,
                                    content: content,
                                    metadata: metadata || null,
                                },
                            })];
                    case 1:
                        message = _a.sent();
                        // Update conversation's updatedAt timestamp
                        return [4 /*yield*/, this.updateConversation(conversationId, {})];
                    case 2:
                        // Update conversation's updatedAt timestamp
                        _a.sent();
                        return [2 /*return*/, message];
                    case 3:
                        error_7 = _a.sent();
                        console.error('Error creating message:', error_7);
                        throw new Error('Failed to create message');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Get files for a conversation
    PrismaChatService.getFiles = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var files, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.file.findMany({
                                where: { conversationId: conversationId },
                                orderBy: { createdAt: 'desc' },
                            })];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, files];
                    case 2:
                        error_8 = _a.sent();
                        console.error('Error fetching files:', error_8);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Create a new file record
    PrismaChatService.createFile = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var file, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.file.create({
                                data: {
                                    id: (0, nanoid_1.nanoid)(),
                                    conversationId: data.conversationId,
                                    fileName: data.fileName,
                                    originalName: data.originalName,
                                    mimeType: data.mimeType,
                                    size: data.size,
                                    status: data.status || 'processing',
                                    extractedContent: data.extractedContent,
                                    analysis: data.analysis,
                                },
                            })];
                    case 1:
                        file = _a.sent();
                        return [2 /*return*/, file];
                    case 2:
                        error_9 = _a.sent();
                        console.error('Error creating file:', error_9);
                        throw new Error('Failed to create file');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Update a file record
    PrismaChatService.updateFile = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var file, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.file.update({
                                where: { id: id },
                                data: updates,
                            })];
                    case 1:
                        file = _a.sent();
                        return [2 /*return*/, file];
                    case 2:
                        error_10 = _a.sent();
                        console.error('Error updating file:', error_10);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get user's chat statistics
    PrismaChatService.getUserStats = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, conversationCount, messageCount, fileCount, error_11;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all([
                                prisma_1.prisma.conversation.count({ where: { userId: userId } }),
                                prisma_1.prisma.message.count({
                                    where: {
                                        conversation: { userId: userId }
                                    }
                                }),
                                prisma_1.prisma.file.count({
                                    where: {
                                        conversation: { userId: userId }
                                    }
                                }),
                            ])];
                    case 1:
                        _a = _b.sent(), conversationCount = _a[0], messageCount = _a[1], fileCount = _a[2];
                        return [2 /*return*/, {
                                conversations: conversationCount,
                                messages: messageCount,
                                files: fileCount,
                            }];
                    case 2:
                        error_11 = _b.sent();
                        console.error('Error fetching user stats:', error_11);
                        return [2 /*return*/, { conversations: 0, messages: 0, files: 0 }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return PrismaChatService;
}());
exports.PrismaChatService = PrismaChatService;
exports.default = PrismaChatService;
