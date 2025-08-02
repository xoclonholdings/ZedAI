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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryCompressorService = void 0;
var zedCoreMemory_js_1 = require("./zedCoreMemory.js");
var fs_1 = require("fs");
var path_1 = require("path");
var uuid_1 = require("uuid");
var MemoryCompressorService = /** @class */ (function () {
    function MemoryCompressorService() {
        var _this = this;
        this.COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB
        this.MAX_CONVERSATION_AGE_DAYS = 90;
        this.MAX_MEMORY_ENTRIES = 10000;
        this.COMPRESSION_INTERVAL_HOURS = 72;
        this.compressionRules = [
            {
                name: 'redundant_responses',
                description: 'Compress repeated assistant responses',
                condition: function (entry) {
                    var _a;
                    return entry.type === 'conversation' &&
                        ((_a = entry.messages) === null || _a === void 0 ? void 0 : _a.some(function (m) { return m.role === 'assistant'; }));
                },
                compress: function (entries) { return _this.compressRedundantResponses(entries); }
            },
            {
                name: 'old_conversations',
                description: 'Archive conversations older than 90 days',
                condition: function (entry) {
                    var ageInDays = (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                    return entry.type === 'conversation' && ageInDays > _this.MAX_CONVERSATION_AGE_DAYS;
                },
                compress: function (entries) { return _this.archiveOldConversations(entries); }
            },
            {
                name: 'memory_deduplication',
                description: 'Remove duplicate memory entries',
                condition: function (entry) { return entry.type !== 'conversation'; },
                compress: function (entries) { return _this.deduplicateMemoryEntries(entries); }
            },
            {
                name: 'conversation_summarization',
                description: 'Summarize long conversation threads',
                condition: function (entry) {
                    var _a;
                    return entry.type === 'conversation' &&
                        ((_a = entry.messages) === null || _a === void 0 ? void 0 : _a.length) > 50;
                },
                compress: function (entries) { return _this.summarizeConversations(entries); }
            }
        ];
        // Auto-start compression scheduler
        this.schedulePeriodicCompression();
    }
    // MAIN COMPRESSION METHODS
    MemoryCompressorService.prototype.compressUserMemory = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, manual) {
            var userCore, originalSize, compressedData, compressedSize, compressionRatio, snapshot;
            var _a, _b;
            if (manual === void 0) { manual = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getUserCore(userId)];
                    case 1:
                        userCore = _c.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        originalSize = JSON.stringify(userCore).length;
                        // Only compress if size exceeds threshold or manual trigger
                        if (!manual && originalSize < this.COMPRESSION_THRESHOLD) {
                            throw new Error('Memory size below compression threshold');
                        }
                        console.log("Starting compression for user ".concat(userId, ", original size: ").concat(originalSize, " bytes"));
                        return [4 /*yield*/, this.applyCompressionRules(userCore)];
                    case 2:
                        compressedData = _c.sent();
                        // Update user core with compressed data
                        userCore.conversations = compressedData.conversations;
                        userCore.memoryEntries = compressedData.memoryEntries;
                        compressedSize = JSON.stringify(userCore).length;
                        compressionRatio = (originalSize - compressedSize) / originalSize;
                        snapshot = {
                            id: (0, uuid_1.v4)(),
                            userId: userId,
                            createdAt: new Date(),
                            type: manual ? 'manual' : 'scheduled',
                            originalSize: originalSize,
                            compressedSize: compressedSize,
                            compressionRatio: compressionRatio,
                            compressedData: {
                                conversations: compressedData.archivedConversations || [],
                                memoryEntries: compressedData.archivedEntries || [],
                                insights: compressedData.insights || []
                            }
                        };
                        // Save snapshot
                        return [4 /*yield*/, this.saveCompressionSnapshot(userId, snapshot)];
                    case 3:
                        // Save snapshot
                        _c.sent();
                        // Update compression history in user core
                        userCore.compressionHistory.push({
                            id: snapshot.id,
                            compressedAt: new Date(),
                            entriesCompressed: (((_a = compressedData.archivedConversations) === null || _a === void 0 ? void 0 : _a.length) || 0) +
                                (((_b = compressedData.archivedEntries) === null || _b === void 0 ? void 0 : _b.length) || 0),
                            sizeBefore: originalSize,
                            sizeAfter: compressedSize,
                            method: manual ? 'manual' : 'automatic'
                        });
                        // Save updated user core
                        return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.saveUserCore(userCore)];
                    case 4:
                        // Save updated user core
                        _c.sent();
                        console.log("Compression completed. Saved ".concat(Math.round(compressionRatio * 100), "% space"));
                        return [2 /*return*/, snapshot];
                }
            });
        });
    };
    MemoryCompressorService.prototype.applyCompressionRules = function (userCore) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _loop_1, _i, _a, rule;
            return __generator(this, function (_b) {
                result = {
                    conversations: __spreadArray([], userCore.conversations, true),
                    memoryEntries: __spreadArray([], userCore.memoryEntries, true),
                    archivedConversations: [],
                    archivedEntries: [],
                    insights: []
                };
                _loop_1 = function (rule) {
                    var _c, _d;
                    console.log("Applying compression rule: ".concat(rule.name));
                    if (rule.name === 'old_conversations') {
                        var oldConversations_1 = result.conversations.filter(rule.condition);
                        var compressed = rule.compress(oldConversations_1);
                        (_c = result.archivedConversations).push.apply(_c, compressed.archived);
                        result.conversations = result.conversations.filter(function (c) { return !oldConversations_1.includes(c); });
                        result.insights.push("Archived ".concat(oldConversations_1.length, " old conversations"));
                    }
                    else if (rule.name === 'redundant_responses') {
                        var beforeCount = result.conversations.length;
                        result.conversations = rule.compress(result.conversations).compressed;
                        var saved = beforeCount - result.conversations.length;
                        if (saved > 0) {
                            result.insights.push("Compressed ".concat(saved, " redundant conversation responses"));
                        }
                    }
                    else if (rule.name === 'memory_deduplication') {
                        var beforeCount = result.memoryEntries.length;
                        var compressed = rule.compress(result.memoryEntries);
                        result.memoryEntries = compressed.compressed;
                        (_d = result.archivedEntries).push.apply(_d, (compressed.duplicates || []));
                        var saved = beforeCount - result.memoryEntries.length;
                        if (saved > 0) {
                            result.insights.push("Removed ".concat(saved, " duplicate memory entries"));
                        }
                    }
                    else if (rule.name === 'conversation_summarization') {
                        var longConversations_1 = result.conversations.filter(rule.condition);
                        if (longConversations_1.length > 0) {
                            var compressed_1 = rule.compress(longConversations_1);
                            result.conversations = result.conversations.map(function (c) {
                                return longConversations_1.find(function (lc) { return lc.id === c.id; }) ?
                                    compressed_1.summaries.find(function (s) { return s.id === c.id; }) || c : c;
                            });
                            result.insights.push("Summarized ".concat(longConversations_1.length, " long conversations"));
                        }
                    }
                };
                // Apply each compression rule
                for (_i = 0, _a = this.compressionRules; _i < _a.length; _i++) {
                    rule = _a[_i];
                    _loop_1(rule);
                }
                return [2 /*return*/, result];
            });
        });
    };
    // COMPRESSION RULE IMPLEMENTATIONS
    MemoryCompressorService.prototype.compressRedundantResponses = function (conversations) {
        var compressed = conversations.map(function (conversation) {
            if (conversation.messages.length < 5)
                return conversation;
            var uniqueMessages = [];
            var seenResponses = new Set();
            for (var _i = 0, _a = conversation.messages; _i < _a.length; _i++) {
                var message = _a[_i];
                if (message.role === 'assistant') {
                    // Check for similar responses (simplified similarity check)
                    var responseKey = message.content.substring(0, 100).toLowerCase();
                    if (!seenResponses.has(responseKey)) {
                        seenResponses.add(responseKey);
                        uniqueMessages.push(message);
                    }
                }
                else {
                    uniqueMessages.push(message);
                }
            }
            return __assign(__assign({}, conversation), { messages: uniqueMessages, updatedAt: new Date() });
        });
        return { compressed: compressed };
    };
    MemoryCompressorService.prototype.archiveOldConversations = function (conversations) {
        var _this = this;
        var archived = conversations.map(function (conversation) {
            var _a;
            return ({
                id: conversation.id,
                title: conversation.title,
                route: conversation.route,
                messageCount: conversation.messages.length,
                createdAt: conversation.createdAt,
                lastMessage: (_a = conversation.messages[conversation.messages.length - 1]) === null || _a === void 0 ? void 0 : _a.content.substring(0, 200),
                archivedAt: new Date(),
                summary: _this.generateConversationSummary(conversation)
            });
        });
        return { archived: archived };
    };
    MemoryCompressorService.prototype.deduplicateMemoryEntries = function (entries) {
        var unique = new Map();
        var duplicates = [];
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            // Create a hash key based on type and content
            var contentHash = this.createContentHash(entry);
            if (unique.has(contentHash)) {
                duplicates.push(entry);
            }
            else {
                unique.set(contentHash, entry);
            }
        }
        return {
            compressed: Array.from(unique.values()),
            duplicates: duplicates
        };
    };
    MemoryCompressorService.prototype.summarizeConversations = function (conversations) {
        var _this = this;
        var summaries = conversations.map(function (conversation) {
            var summary = _this.generateConversationSummary(conversation);
            // Keep first few and last few messages, summarize the middle
            var messages = conversation.messages;
            var keepStart = messages.slice(0, 3);
            var keepEnd = messages.slice(-3);
            var summarizedMessages = __spreadArray(__spreadArray(__spreadArray([], keepStart, true), [
                {
                    id: (0, uuid_1.v4)(),
                    role: 'system',
                    content: "[Conversation Summary: ".concat(summary, "]"),
                    timestamp: new Date()
                }
            ], false), keepEnd, true);
            return __assign(__assign({}, conversation), { messages: summarizedMessages, updatedAt: new Date(), compressed: true, originalMessageCount: messages.length });
        });
        return { summaries: summaries };
    };
    // UTILITY METHODS
    MemoryCompressorService.prototype.generateConversationSummary = function (conversation) {
        var userMessages = conversation.messages.filter(function (m) { return m.role === 'user'; });
        var topics = userMessages.map(function (m) { return m.content.substring(0, 50); }).join(', ');
        return "Conversation about: ".concat(topics, ". ").concat(conversation.messages.length, " messages exchanged.");
    };
    MemoryCompressorService.prototype.createContentHash = function (entry) {
        var hashContent = "".concat(entry.type, "_").concat(JSON.stringify(entry.content).substring(0, 100));
        return Buffer.from(hashContent).toString('base64');
    };
    MemoryCompressorService.prototype.saveCompressionSnapshot = function (userId, snapshot) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshotsPath, snapshotFile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        snapshotsPath = path_1.default.join(process.cwd(), 'core', 'memory', 'users', userId, 'snapshots');
                        return [4 /*yield*/, fs_1.promises.mkdir(snapshotsPath, { recursive: true })];
                    case 1:
                        _a.sent();
                        snapshotFile = path_1.default.join(snapshotsPath, "".concat(snapshot.id, ".json"));
                        return [4 /*yield*/, fs_1.promises.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MemoryCompressorService.prototype.getCompressionSnapshots = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshotsPath, files, snapshots, _i, _a, file, filePath, data, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        snapshotsPath = path_1.default.join(process.cwd(), 'core', 'memory', 'users', userId, 'snapshots');
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, fs_1.promises.readdir(snapshotsPath)];
                    case 2:
                        files = _c.sent();
                        snapshots = [];
                        _i = 0, _a = files.filter(function (f) { return f.endsWith('.json'); });
                        _c.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        file = _a[_i];
                        filePath = path_1.default.join(snapshotsPath, file);
                        return [4 /*yield*/, fs_1.promises.readFile(filePath, 'utf-8')];
                    case 4:
                        data = _c.sent();
                        snapshots.push(JSON.parse(data));
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/, snapshots.sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })];
                    case 7:
                        _b = _c.sent();
                        return [2 /*return*/, []];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    // COMPRESSION SCHEDULING
    MemoryCompressorService.prototype.schedulePeriodicCompression = function () {
        var _this = this;
        setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('Running scheduled memory compression...');
                        return [4 /*yield*/, this.runScheduledCompression()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, this.COMPRESSION_INTERVAL_HOURS * 60 * 60 * 1000);
    };
    MemoryCompressorService.prototype.runScheduledCompression = function () {
        return __awaiter(this, void 0, void 0, function () {
            var userIds, _i, userIds_1, userId, stats, error_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getAllUserIds()];
                    case 1:
                        userIds = _a.sent();
                        _i = 0, userIds_1 = userIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < userIds_1.length)) return [3 /*break*/, 9];
                        userId = userIds_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getMemoryStats(userId)];
                    case 4:
                        stats = _a.sent();
                        if (!(stats.memorySize > this.COMPRESSION_THRESHOLD)) return [3 /*break*/, 6];
                        console.log("Compressing memory for user ".concat(userId));
                        return [4 /*yield*/, this.compressUserMemory(userId, false)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_1 = _a.sent();
                        console.error("Error compressing memory for user ".concat(userId, ":"), error_1);
                        return [3 /*break*/, 8];
                    case 8:
                        _i++;
                        return [3 /*break*/, 2];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_2 = _a.sent();
                        console.error('Error in scheduled compression:', error_2);
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    // MANUAL TRIGGERS
    MemoryCompressorService.prototype.triggerCompressionForUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.compressUserMemory(userId, true)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryCompressorService.prototype.triggerCompressionForAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var userIds, results, _i, userIds_2, userId, snapshot, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getAllUserIds()];
                    case 1:
                        userIds = _a.sent();
                        results = [];
                        _i = 0, userIds_2 = userIds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < userIds_2.length)) return [3 /*break*/, 7];
                        userId = userIds_2[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.compressUserMemory(userId, true)];
                    case 4:
                        snapshot = _a.sent();
                        results.push(snapshot);
                        return [3 /*break*/, 6];
                    case 5:
                        error_3 = _a.sent();
                        console.error("Error compressing memory for user ".concat(userId, ":"), error_3);
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, results];
                }
            });
        });
    };
    // COMPRESSION ANALYSIS
    MemoryCompressorService.prototype.getCompressionAnalytics = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, history, totalSpaceSaved, averageRatio;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        history = userCore.compressionHistory;
                        totalSpaceSaved = history.reduce(function (sum, h) { return sum + (h.sizeBefore - h.sizeAfter); }, 0);
                        averageRatio = history.length > 0 ?
                            history.reduce(function (sum, h) { return sum + ((h.sizeBefore - h.sizeAfter) / h.sizeBefore); }, 0) / history.length : 0;
                        return [2 /*return*/, {
                                totalCompressions: history.length,
                                totalSpaceSaved: totalSpaceSaved,
                                averageCompressionRatio: averageRatio,
                                lastCompressionDate: history.length > 0 ? history[history.length - 1].compressedAt : undefined,
                                compressionHistory: history
                            }];
                }
            });
        });
    };
    return MemoryCompressorService;
}());
exports.memoryCompressorService = new MemoryCompressorService();
