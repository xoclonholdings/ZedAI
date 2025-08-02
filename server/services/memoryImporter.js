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
exports.memoryImporter = exports.MemoryImporter = void 0;
var promises_1 = require("fs/promises");
var path_1 = require("path");
var memoryService_1 = require("./memoryService");
var MemoryImporter = /** @class */ (function () {
    function MemoryImporter() {
    }
    /**
     * Import OpenAI data export and process into ZED memory format
     */
    MemoryImporter.importOpenAIExport = function (exportFolderPath) {
        return __awaiter(this, void 0, void 0, function () {
            var files, conversations, assistantMemory, userContext, _i, files_1, file, filePath, fileStats, fileContent, data, error_1, zedPersonality, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        console.log("[MEMORY IMPORT] Starting import from: ".concat(exportFolderPath));
                        return [4 /*yield*/, promises_1.default.readdir(exportFolderPath)];
                    case 1:
                        files = _a.sent();
                        console.log("[MEMORY IMPORT] Found ".concat(files.length, " files to process"));
                        conversations = [];
                        assistantMemory = {};
                        userContext = {};
                        _i = 0, files_1 = files;
                        _a.label = 2;
                    case 2:
                        if (!(_i < files_1.length)) return [3 /*break*/, 8];
                        file = files_1[_i];
                        filePath = path_1.default.join(exportFolderPath, file);
                        return [4 /*yield*/, promises_1.default.stat(filePath)];
                    case 3:
                        fileStats = _a.sent();
                        if (!(fileStats.isFile() && file.endsWith('.json'))) return [3 /*break*/, 7];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, promises_1.default.readFile(filePath, 'utf-8')];
                    case 5:
                        fileContent = _a.sent();
                        data = JSON.parse(fileContent);
                        // Detect file type and process accordingly
                        if (file.includes('conversation') || data.conversations) {
                            conversations = conversations.concat(data.conversations || [data]);
                        }
                        else if (file.includes('memory') || file.includes('assistant')) {
                            assistantMemory = __assign(__assign({}, assistantMemory), data);
                        }
                        else if (file.includes('user') || file.includes('context')) {
                            userContext = __assign(__assign({}, userContext), data);
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error("[MEMORY IMPORT] Error processing file ".concat(file, ":"), error_1);
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [4 /*yield*/, this.transformToZEDFormat({
                            conversations: conversations,
                            assistantMemory: assistantMemory,
                            userContext: userContext
                        })];
                    case 9:
                        zedPersonality = _a.sent();
                        console.log("[MEMORY IMPORT] Successfully processed ".concat(conversations.length, " conversations"));
                        return [2 /*return*/, zedPersonality];
                    case 10:
                        error_2 = _a.sent();
                        console.error('[MEMORY IMPORT] Failed to import OpenAI export:', error_2);
                        throw new Error("Memory import failed: ".concat(error_2));
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Transform OpenAI format to ZED personality format
     */
    MemoryImporter.transformToZEDFormat = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversations, assistantMemory, userContext, corePersonality, communicationStyle, knowledgeDomains, responsePatterns, contextualMemory, userInteractionHistory;
            return __generator(this, function (_a) {
                conversations = data.conversations, assistantMemory = data.assistantMemory, userContext = data.userContext;
                corePersonality = "You are ZED, an advanced AI assistant with comprehensive knowledge and adaptive personality.";
                if (assistantMemory === null || assistantMemory === void 0 ? void 0 : assistantMemory.personality) {
                    corePersonality = assistantMemory.personality;
                }
                else if (assistantMemory === null || assistantMemory === void 0 ? void 0 : assistantMemory.instructions) {
                    corePersonality = assistantMemory.instructions;
                }
                communicationStyle = this.extractCommunicationStyle(conversations);
                knowledgeDomains = this.extractKnowledgeDomains(conversations);
                responsePatterns = this.extractResponsePatterns(conversations);
                contextualMemory = this.buildContextualMemory(conversations);
                userInteractionHistory = this.buildUserInteractionHistory(conversations, userContext);
                return [2 /*return*/, {
                        corePersonality: corePersonality,
                        communicationStyle: communicationStyle,
                        knowledgeDomains: knowledgeDomains,
                        responsePatterns: responsePatterns,
                        contextualMemory: contextualMemory,
                        userInteractionHistory: userInteractionHistory
                    }];
            });
        });
    };
    /**
     * Extract communication style from conversation patterns
     */
    MemoryImporter.extractCommunicationStyle = function (conversations) {
        var styles = {
            professional: 0,
            casual: 0,
            technical: 0,
            supportive: 0,
            analytical: 0
        };
        conversations.forEach(function (conv) {
            var _a;
            (_a = conv.messages) === null || _a === void 0 ? void 0 : _a.forEach(function (msg) {
                if (msg.role === 'assistant') {
                    var content = msg.content.toLowerCase();
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
        var dominantStyle = Object.entries(styles).reduce(function (a, b) {
            return styles[a[0]] > styles[b[0]] ? a : b;
        })[0];
        return "Primary communication style: ".concat(dominantStyle, ". Adapts to user needs with ").concat(Object.entries(styles)
            .filter(function (_a) {
            var _ = _a[0], count = _a[1];
            return count > 0;
        })
            .map(function (_a) {
            var style = _a[0], _ = _a[1];
            return style;
        })
            .join(', '), " approaches.");
    };
    /**
     * Extract knowledge domains from conversation topics
     */
    MemoryImporter.extractKnowledgeDomains = function (conversations) {
        var domains = new Set();
        conversations.forEach(function (conv) {
            var _a;
            var title = ((_a = conv.title) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            var messages = conv.messages || [];
            // Analyze conversation topics
            var fullText = (title + ' ' + messages.map(function (m) { return m.content; }).join(' ')).toLowerCase();
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
    };
    /**
     * Extract response patterns from assistant messages
     */
    MemoryImporter.extractResponsePatterns = function (conversations) {
        var patterns = new Set();
        conversations.forEach(function (conv) {
            var _a;
            (_a = conv.messages) === null || _a === void 0 ? void 0 : _a.forEach(function (msg) {
                if (msg.role === 'assistant') {
                    var content = msg.content;
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
    };
    /**
     * Build contextual memory from conversations
     */
    MemoryImporter.buildContextualMemory = function (conversations) {
        var _this = this;
        var contextualMemory = [];
        conversations.forEach(function (conv) {
            var category = _this.categorizeConversation(conv);
            var relevantContent = _this.extractRelevantContent(conv);
            if (relevantContent) {
                contextualMemory.push({
                    category: category,
                    content: relevantContent,
                    relevance: _this.calculateRelevance(conv),
                    timestamp: new Date().toISOString()
                });
            }
        });
        // Sort by relevance and keep top 100
        return contextualMemory
            .sort(function (a, b) { return b.relevance - a.relevance; })
            .slice(0, 100);
    };
    /**
     * Build user interaction history
     */
    MemoryImporter.buildUserInteractionHistory = function (conversations, userContext) {
        var _this = this;
        var interactionHistory = [];
        conversations.forEach(function (conv) {
            if (conv.messages && conv.messages.length > 2) {
                var userMessages = conv.messages.filter(function (m) { return m.role === 'user'; });
                var assistantMessages = conv.messages.filter(function (m) { return m.role === 'assistant'; });
                if (userMessages.length > 0 && assistantMessages.length > 0) {
                    interactionHistory.push({
                        topic: conv.title || _this.extractTopic(userMessages[0].content),
                        userPreference: _this.extractUserPreference(userMessages),
                        outcome: _this.evaluateOutcome(assistantMessages),
                        timestamp: conv.messages[0].timestamp || new Date().toISOString()
                    });
                }
            }
        });
        return interactionHistory.slice(0, 50); // Keep top 50 interactions
    };
    // Helper methods
    MemoryImporter.categorizeConversation = function (conv) {
        var _a, _b;
        var title = ((_a = conv.title) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
        var content = ((_b = conv.messages) === null || _b === void 0 ? void 0 : _b.map(function (m) { return m.content; }).join(' ').toLowerCase()) || '';
        if (content.includes('code') || content.includes('programming'))
            return 'Technical';
        if (content.includes('analysis') || content.includes('data'))
            return 'Analysis';
        if (content.includes('design') || content.includes('creative'))
            return 'Creative';
        if (content.includes('business') || content.includes('strategy'))
            return 'Business';
        if (content.includes('help') || content.includes('support'))
            return 'Support';
        return 'General';
    };
    MemoryImporter.extractRelevantContent = function (conv) {
        var messages = conv.messages || [];
        var assistantMessages = messages.filter(function (m) { return m.role === 'assistant'; });
        if (assistantMessages.length === 0)
            return '';
        // Get the most comprehensive assistant response
        var longestResponse = assistantMessages.reduce(function (longest, current) {
            return current.content.length > longest.content.length ? current : longest;
        });
        return longestResponse.content.substring(0, 1000); // Limit content length
    };
    MemoryImporter.calculateRelevance = function (conv) {
        var relevance = 0;
        var messages = conv.messages || [];
        relevance += messages.length * 0.1; // More messages = more relevant
        var totalLength = messages.reduce(function (sum, m) { return sum + m.content.length; }, 0);
        relevance += Math.min(totalLength / 1000, 5); // Content depth
        // Check for technical or complex topics
        var fullText = messages.map(function (m) { return m.content; }).join(' ').toLowerCase();
        if (fullText.includes('implement') || fullText.includes('analyze') || fullText.includes('solution')) {
            relevance += 2;
        }
        return Math.min(relevance, 10); // Cap at 10
    };
    MemoryImporter.extractTopic = function (content) {
        var words = content.split(' ');
        return words.slice(0, 5).join(' '); // First 5 words as topic
    };
    MemoryImporter.extractUserPreference = function (userMessages) {
        var preferences = [];
        userMessages.forEach(function (msg) {
            var content = msg.content.toLowerCase();
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
    };
    MemoryImporter.evaluateOutcome = function (assistantMessages) {
        if (assistantMessages.length === 0)
            return 'incomplete';
        if (assistantMessages.length === 1)
            return 'single_response';
        if (assistantMessages.length > 3)
            return 'extended_conversation';
        return 'standard_resolution';
    };
    /**
     * Save processed personality data to ZED's memory system
     */
    MemoryImporter.saveToZEDMemory = function (personalityData_1) {
        return __awaiter(this, arguments, void 0, function (personalityData, isAdminMode) {
            var prefix, i, chunk, i, chunk, error_3;
            if (isAdminMode === void 0) { isAdminMode = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 14, , 15]);
                        prefix = isAdminMode ? 'admin_' : 'user_';
                        // Save core personality
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "zed_personality"), personalityData.corePersonality)];
                    case 1:
                        // Save core personality
                        _a.sent();
                        // Save communication style
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "communication_style"), personalityData.communicationStyle)];
                    case 2:
                        // Save communication style
                        _a.sent();
                        // Save knowledge domains
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "knowledge_domains"), JSON.stringify(personalityData.knowledgeDomains))];
                    case 3:
                        // Save knowledge domains
                        _a.sent();
                        // Save response patterns
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "response_patterns"), JSON.stringify(personalityData.responsePatterns))];
                    case 4:
                        // Save response patterns
                        _a.sent();
                        i = 0;
                        _a.label = 5;
                    case 5:
                        if (!(i < personalityData.contextualMemory.length)) return [3 /*break*/, 8];
                        chunk = personalityData.contextualMemory.slice(i, i + 10);
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "contextual_memory_").concat(Math.floor(i / 10)), JSON.stringify(chunk))];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        i += 10;
                        return [3 /*break*/, 5];
                    case 8:
                        i = 0;
                        _a.label = 9;
                    case 9:
                        if (!(i < personalityData.userInteractionHistory.length)) return [3 /*break*/, 12];
                        chunk = personalityData.userInteractionHistory.slice(i, i + 10);
                        return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "interaction_history_").concat(Math.floor(i / 10)), JSON.stringify(chunk))];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11:
                        i += 10;
                        return [3 /*break*/, 9];
                    case 12: 
                    // Save metadata
                    return [4 /*yield*/, memoryService_1.MemoryService.setCoreMemory("".concat(prefix, "import_metadata"), JSON.stringify({
                            importDate: new Date().toISOString(),
                            conversationCount: personalityData.contextualMemory.length,
                            knowledgeDomainCount: personalityData.knowledgeDomains.length,
                            interactionCount: personalityData.userInteractionHistory.length
                        }))];
                    case 13:
                        // Save metadata
                        _a.sent();
                        console.log("[MEMORY IMPORT] Successfully saved ".concat(isAdminMode ? 'admin' : 'user', " personality to ZED memory"));
                        return [3 /*break*/, 15];
                    case 14:
                        error_3 = _a.sent();
                        console.error('[MEMORY IMPORT] Failed to save to ZED memory:', error_3);
                        throw error_3;
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    return MemoryImporter;
}());
exports.MemoryImporter = MemoryImporter;
// Export singleton instance
exports.memoryImporter = new MemoryImporter();
