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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLStorage = void 0;
var prisma_1 = require("./prisma");
var PostgreSQLStorage = /** @class */ (function () {
    function PostgreSQLStorage() {
    }
    // User operations
    PostgreSQLStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                            where: { id: id }
                        })];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.getUserByUsername = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                            where: { email: username }
                        })];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user || undefined];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.upsertUser = function (userData) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.upsert({
                            where: { id: userData.id },
                            update: {
                                email: userData.email,
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                profileImageUrl: userData.profileImageUrl,
                                updatedAt: new Date(), // If your schema uses 'updatedAt', otherwise use the correct field
                            },
                            create: {
                                id: userData.id,
                                email: userData.email,
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                profileImageUrl: userData.profileImageUrl,
                            },
                        })];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.createUser = function (userData) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.create({
                            data: {
                                email: userData.email,
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                profileImageUrl: userData.profileImageUrl,
                            },
                        })];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user];
                }
            });
        });
    };
    // Conversation operations
    PostgreSQLStorage.prototype.getConversations = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var conversations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.conversation.findMany({
                            where: { userId: userId }, // If your schema uses 'userId', otherwise use the correct field
                            orderBy: { updatedAt: 'desc' }, // If your schema uses 'updatedAt'
                        })];
                    case 1:
                        conversations = _a.sent();
                        return [2 /*return*/, conversations];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.getConversation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.conversation.findUnique({
                            where: { id: id },
                        })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.createConversation = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.conversation.create({
                            data: {
                                title: data.title,
                                mode: data.mode,
                                userId: data.userId, // If your schema uses 'userId'
                            },
                        })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.updateConversation = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.conversation.update({
                            where: { id: id },
                            data: __assign({}, data),
                        })];
                    case 1:
                        conversation = _a.sent();
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.deleteConversation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.conversation.delete({
                                where: { id: id },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Message operations
    PostgreSQLStorage.prototype.getMessages = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var messages;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.message.findMany({
                            where: { conversationId: conversationId }, // If your schema uses 'conversationId'
                            orderBy: { createdAt: 'asc' }, // If your schema uses 'createdAt'
                        })];
                    case 1:
                        messages = _a.sent();
                        return [2 /*return*/, messages];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.createMessage = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.message.create({
                            data: {
                                content: data.content,
                                role: data.role,
                                conversationId: data.conversationId, // If your schema uses 'conversationId'
                            },
                        })];
                    case 1:
                        message = _a.sent();
                        return [2 /*return*/, message];
                }
            });
        });
    };
    // File operations
    PostgreSQLStorage.prototype.getFiles = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            var files;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.file.findMany({
                            where: { conversationId: conversationId }, // If your schema uses 'conversationId'
                            orderBy: { createdAt: 'desc' }, // Use the correct field name from your schema
                        })];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, files];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.createFile = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.file.create({
                            data: {
                                fileName: data.fileName, // If your schema uses 'fileName'
                                originalName: data.originalName, // If your schema uses 'originalName'
                                size: data.size,
                                mimeType: data.mimeType, // If your schema uses 'mimeType'
                                status: data.status,
                                extractedContent: data.extractedContent, // If your schema uses 'extractedContent'
                                analysis: data.analysis === null ? undefined : data.analysis,
                                conversationId: data.conversationId, // If your schema uses 'conversationId'
                            },
                        })];
                    case 1:
                        file = _a.sent();
                        return [2 /*return*/, file];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.updateFile = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversationId, updateData, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        conversationId = data.conversationId, updateData = __rest(data, ["conversationId"]);
                        return [4 /*yield*/, prisma_1.prisma.file.update({
                                where: { id: id },
                                data: __assign(__assign({}, updateData), { analysis: updateData.analysis }),
                            })];
                    case 1:
                        file = _a.sent();
                        return [2 /*return*/, file];
                }
            });
        });
    };
    // Memory operations
    PostgreSQLStorage.prototype.getCoreMemory = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var memory;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.coreMemory.findUnique({
                            where: { key: key },
                        })];
                    case 1:
                        memory = _a.sent();
                        return [2 /*return*/, memory ? JSON.parse(memory.value) : undefined]; // Use 'value' if that's your schema field
                }
            });
        });
    };
    PostgreSQLStorage.prototype.setCoreMemory = function (key, content, updatedBy) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.coreMemory.upsert({
                            where: { key: key },
                            update: {
                                value: JSON.stringify(content), // Use 'value' if that's your schema field
                                updated_at: new Date(), // Use 'updated_at' if that's your schema field
                            },
                            create: {
                                key: key,
                                value: JSON.stringify(content),
                            },
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.getProjectMemory = function (userId, key) {
        return __awaiter(this, void 0, void 0, function () {
            var memory;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.projectMemory.findUnique({
                            where: { user_id_key: { user_id: userId, key: key } }, // Use the actual composite unique field name from your schema.prisma
                        })];
                    case 1:
                        memory = _a.sent();
                        return [2 /*return*/, memory ? JSON.parse(memory.content) : undefined];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.setProjectMemory = function (userId, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.projectMemory.upsert({
                            where: { user_id_key: { user_id: userId, key: key } }, // Use the actual composite unique field name from your schema.prisma
                            update: {
                                content: JSON.stringify(content),
                                updated_at: new Date(),
                            },
                            create: {
                                user_id: userId, // Use the actual field name from your Prisma schema
                                key: key, // Use the actual field name from your Prisma schema
                                value: JSON.stringify(content),
                            },
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.getScratchpadMemory = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var memories;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.scratchpadMemory.findMany({
                            where: {
                                user_id: userId, // Use 'user_id' as per your schema
                                expires_at: { gt: new Date() }, // If your schema uses 'expires_at'
                            },
                            orderBy: { expires_at: 'desc' }, // Use the correct field name from your schema
                        })];
                    case 1:
                        memories = _a.sent();
                        // Use 'content' if that's your schema field
                        return [2 /*return*/, memories.map(function (m) { return JSON.parse(m.content); })];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.addScratchpadMemory = function (userId, content) {
        return __awaiter(this, void 0, void 0, function () {
            var expiresAt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expiresAt = new Date();
                        expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry
                        return [4 /*yield*/, prisma_1.prisma.scratchpadMemory.create({
                                data: {
                                    user_id: userId, // Use 'user_id' as per your schema
                                    content: JSON.stringify(content), // Use 'content' if that's your schema field
                                    expires_at: expiresAt, // Use 'expires_at' as per your schema
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.cleanupExpiredMemory = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.scratchpadMemory.deleteMany({
                            where: {
                                expires_at: { lt: new Date() }, // Use 'expires_at' as per your schema
                            },
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Additional utility methods
    PostgreSQLStorage.prototype.getUserStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, totalUsers, adminUsers, activeUsers;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            prisma_1.prisma.user.count(),
                            prisma_1.prisma.user.count(), // Count all users (replace with a valid filter if you have an admin indicator field)
                            prisma_1.prisma.user.count({
                                where: {
                                    conversations: {
                                        some: {
                                            updatedAt: {
                                                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                                            },
                                        },
                                    },
                                },
                            }),
                        ])];
                    case 1:
                        _a = _b.sent(), totalUsers = _a[0], adminUsers = _a[1], activeUsers = _a[2];
                        return [2 /*return*/, {
                                totalUsers: totalUsers,
                                adminUsers: adminUsers,
                                activeUsers: activeUsers,
                            }];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.getAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var users;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.findMany({
                            orderBy: { createdAt: 'desc' }, // If your schema uses 'createdAt'
                        })];
                    case 1:
                        users = _a.sent();
                        return [2 /*return*/, users];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.updateUser = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma_1.prisma.user.update({
                            where: { id: id },
                            data: __assign(__assign({}, data), { updatedAt: new Date() }),
                        })];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user];
                }
            });
        });
    };
    PostgreSQLStorage.prototype.deleteUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.prisma.user.delete({
                                where: { id: id },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_2 = _a.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return PostgreSQLStorage;
}());
exports.PostgreSQLStorage = PostgreSQLStorage;
