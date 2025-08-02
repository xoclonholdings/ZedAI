"use strict";
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
exports.PersonalityLoader = void 0;
var memoryService_1 = require("./memoryService");
var PersonalityLoader = /** @class */ (function () {
    function PersonalityLoader() {
    }
    /**
     * Load appropriate personality based on user access level
     */
    PersonalityLoader.loadPersonalityForUser = function (userProfile) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        console.log("[PERSONALITY LOADER] Loading personality for user ".concat(userProfile.userId, " with access level: ").concat(userProfile.accessLevel));
                        if (!(userProfile.accessLevel === 'admin' && userProfile.personalityMode === 'enhanced')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.loadEnhancedPersonality()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, this.loadStandardPersonality()];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        error_1 = _a.sent();
                        console.error('[PERSONALITY LOADER] Failed to load personality:', error_1);
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load enhanced personality from imported OpenAI data (Admin only)
     */
    PersonalityLoader.loadEnhancedPersonality = function () {
        return __awaiter(this, void 0, void 0, function () {
            var corePersonality, communicationStyle, knowledgeDomains, responsePatterns, contextualMemory, userInteractionHistory, enhancedPersonality, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 11]);
                        console.log('[PERSONALITY LOADER] Loading enhanced admin personality');
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_zed_personality')];
                    case 1:
                        corePersonality = _a.sent();
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_communication_style')];
                    case 2:
                        communicationStyle = _a.sent();
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_knowledge_domains')];
                    case 3:
                        knowledgeDomains = _a.sent();
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_response_patterns')];
                    case 4:
                        responsePatterns = _a.sent();
                        if (!!corePersonality) return [3 /*break*/, 6];
                        console.log('[PERSONALITY LOADER] No enhanced personality found, using standard');
                        return [4 /*yield*/, this.loadStandardPersonality()];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6: return [4 /*yield*/, this.loadMemoryChunks('admin_contextual_memory_')];
                    case 7:
                        contextualMemory = _a.sent();
                        return [4 /*yield*/, this.loadMemoryChunks('admin_interaction_history_')];
                    case 8:
                        userInteractionHistory = _a.sent();
                        enhancedPersonality = {
                            corePersonality: corePersonality.value,
                            communicationStyle: (communicationStyle === null || communicationStyle === void 0 ? void 0 : communicationStyle.value) || 'Professional and adaptive',
                            knowledgeDomains: (knowledgeDomains === null || knowledgeDomains === void 0 ? void 0 : knowledgeDomains.value) ? JSON.parse(knowledgeDomains.value) : [],
                            responsePatterns: (responsePatterns === null || responsePatterns === void 0 ? void 0 : responsePatterns.value) ? JSON.parse(responsePatterns.value) : [],
                            contextualMemory: contextualMemory,
                            userInteractionHistory: userInteractionHistory
                        };
                        console.log("[PERSONALITY LOADER] Enhanced personality loaded with ".concat(contextualMemory.length, " contextual memories and ").concat(userInteractionHistory.length, " interactions"));
                        return [2 /*return*/, enhancedPersonality];
                    case 9:
                        error_2 = _a.sent();
                        console.error('[PERSONALITY LOADER] Error loading enhanced personality:', error_2);
                        return [4 /*yield*/, this.loadStandardPersonality()];
                    case 10: return [2 /*return*/, _a.sent()];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load standard personality for regular users
     */
    PersonalityLoader.loadStandardPersonality = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log('[PERSONALITY LOADER] Loading standard user personality');
                return [2 /*return*/, {
                        corePersonality: "You are ZED, an advanced AI assistant designed to help users with a wide range of tasks. \n      \nYou are knowledgeable, helpful, and adaptive to user needs. You provide clear, accurate information and practical solutions. You maintain a professional yet approachable tone and always aim to be genuinely helpful.\n\nKey characteristics:\n\u2022 Intelligent and analytical problem-solving approach\n\u2022 Clear, structured communication\n\u2022 Proactive in offering relevant suggestions\n\u2022 Respectful of user time and preferences\n\u2022 Capable of handling technical and creative tasks\n\u2022 Maintains context throughout conversations",
                        communicationStyle: "Professional yet approachable. Adapts to user communication style while maintaining clarity and helpfulness. Uses structured responses for complex topics and conversational tone for general inquiries.",
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
                    }];
            });
        });
    };
    /**
     * Load memory chunks from core memory
     */
    PersonalityLoader.loadMemoryChunks = function (prefix) {
        return __awaiter(this, void 0, void 0, function () {
            var chunks, chunkIndex, chunkMemory, chunkData, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chunks = [];
                        chunkIndex = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        _a.label = 2;
                    case 2:
                        if (!true) return [3 /*break*/, 4];
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory("".concat(prefix).concat(chunkIndex))];
                    case 3:
                        chunkMemory = _a.sent();
                        if (!chunkMemory)
                            return [3 /*break*/, 4];
                        try {
                            chunkData = JSON.parse(chunkMemory.value);
                            chunks.push.apply(chunks, chunkData);
                        }
                        catch (parseError) {
                            console.error("[PERSONALITY LOADER] Error parsing chunk ".concat(prefix).concat(chunkIndex, ":"), parseError);
                        }
                        chunkIndex++;
                        return [3 /*break*/, 2];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_3 = _a.sent();
                        console.error("[PERSONALITY LOADER] Error loading chunks for ".concat(prefix, ":"), error_3);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, chunks];
                }
            });
        });
    };
    /**
     * Build enhanced system message for AI using loaded personality
     */
    PersonalityLoader.buildEnhancedSystemMessage = function (personality, mode) {
        var systemMessage = personality.corePersonality;
        // Add communication style
        systemMessage += "\n\nCommunication Style: ".concat(personality.communicationStyle);
        // Add knowledge domains
        if (personality.knowledgeDomains.length > 0) {
            systemMessage += "\n\nKnowledge Domains: ".concat(personality.knowledgeDomains.join(', '));
        }
        // Add response patterns
        if (personality.responsePatterns.length > 0) {
            systemMessage += "\n\nResponse Patterns:\n".concat(personality.responsePatterns.map(function (pattern) { return "\u2022 ".concat(pattern); }).join('\n'));
        }
        // Add relevant contextual memory (top 5 most relevant)
        if (personality.contextualMemory.length > 0) {
            var topMemories = personality.contextualMemory
                .sort(function (a, b) { return b.relevance - a.relevance; })
                .slice(0, 5);
            systemMessage += "\n\nContextual Knowledge:\n".concat(topMemories.map(function (memory) {
                return "\u2022 ".concat(memory.category, ": ").concat(memory.content.substring(0, 200)).concat(memory.content.length > 200 ? '...' : '');
            }).join('\n'));
        }
        // Add interaction patterns
        if (personality.userInteractionHistory.length > 0) {
            var recentInteractions = personality.userInteractionHistory.slice(0, 3);
            systemMessage += "\n\nUser Interaction Patterns:\n".concat(recentInteractions.map(function (interaction) {
                return "\u2022 ".concat(interaction.topic, ": ").concat(interaction.userPreference);
            }).join('\n'));
        }
        // Add mode-specific instructions
        if (mode === 'agent') {
            systemMessage += "\n\nAgent Mode: You operate with enhanced autonomy and comprehensive analysis capabilities. Draw upon your full knowledge base and interaction history to provide thorough, proactive assistance. You have unlimited processing capability and access to all contextual memory.";
        }
        else {
            systemMessage += "\n\nChat Mode: Engage conversationally while leveraging your enhanced knowledge and experience. Adapt your responses based on user preferences and historical interaction patterns.";
        }
        return systemMessage;
    };
    /**
     * Get personality statistics for admin dashboard
     */
    PersonalityLoader.getPersonalityStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var adminPersonality, metadata, stats, metadataObj, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_zed_personality')];
                    case 1:
                        adminPersonality = _a.sent();
                        return [4 /*yield*/, memoryService_1.MemoryService.getCoreMemory('admin_import_metadata')];
                    case 2:
                        metadata = _a.sent();
                        stats = {
                            adminPersonality: !!adminPersonality,
                            standardPersonality: true, // Always available
                            contextualMemoryCount: 0,
                            interactionHistoryCount: 0,
                            knowledgeDomainCount: 0,
                            lastImportDate: undefined
                        };
                        if (metadata) {
                            try {
                                metadataObj = JSON.parse(metadata.value);
                                stats.contextualMemoryCount = metadataObj.conversationCount || 0;
                                stats.interactionHistoryCount = metadataObj.interactionCount || 0;
                                stats.knowledgeDomainCount = metadataObj.knowledgeDomainCount || 0;
                                stats.lastImportDate = metadataObj.importDate;
                            }
                            catch (parseError) {
                                console.error('[PERSONALITY LOADER] Error parsing metadata:', parseError);
                            }
                        }
                        return [2 /*return*/, stats];
                    case 3:
                        error_4 = _a.sent();
                        console.error('[PERSONALITY LOADER] Error getting personality stats:', error_4);
                        return [2 /*return*/, {
                                adminPersonality: false,
                                standardPersonality: true,
                                contextualMemoryCount: 0,
                                interactionHistoryCount: 0,
                                knowledgeDomainCount: 0
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return PersonalityLoader;
}());
exports.PersonalityLoader = PersonalityLoader;
