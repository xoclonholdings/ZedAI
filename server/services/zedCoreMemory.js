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
exports.zedCoreMemoryService = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var uuid_1 = require("uuid");
var ZedCoreMemoryService = /** @class */ (function () {
    function ZedCoreMemoryService() {
        this.coreMemoryPath = path_1.default.join(process.cwd(), 'core', 'memory');
        this.adminMemoryPath = path_1.default.join(this.coreMemoryPath, 'adminZED.json');
        this.usersMemoryPath = path_1.default.join(this.coreMemoryPath, 'users');
        this.uploadsPath = path_1.default.join(process.cwd(), 'user_uploads');
        this.outputPath = path_1.default.join(process.cwd(), 'ai_output');
        this.ensureDirectories();
    }
    ZedCoreMemoryService.prototype.ensureDirectories = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, _i, dirs_1, dir, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dirs = [
                            this.coreMemoryPath,
                            this.usersMemoryPath,
                            this.uploadsPath,
                            this.outputPath
                        ];
                        _i = 0, dirs_1 = dirs;
                        _b.label = 1;
                    case 1:
                        if (!(_i < dirs_1.length)) return [3 /*break*/, 7];
                        dir = dirs_1[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 6]);
                        return [4 /*yield*/, fs_1.promises.access(dir)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        _a = _b.sent();
                        return [4 /*yield*/, fs_1.promises.mkdir(dir, { recursive: true })];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ADMIN ZED CORE MANAGEMENT
    ZedCoreMemoryService.prototype.saveAdminCore = function (adminCore) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_1.promises.writeFile(this.adminMemoryPath, JSON.stringify(adminCore, null, 2), 'utf-8')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.getAdminCore = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs_1.promises.readFile(this.adminMemoryPath, 'utf-8')];
                    case 1:
                        data = _b.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.initializeAdminCoreFromImport = function (importedData) {
        return __awaiter(this, void 0, void 0, function () {
            var adminCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adminCore = {
                            version: '1.0.0',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            isTemplate: true,
                            basePersonality: importedData.personality || {},
                            adminKnowledge: importedData.knowledge || {},
                            systemPrompts: importedData.systemPrompts || {},
                            defaultModules: importedData.modules || ['chat', 'analysis', 'generation'],
                            defaultPreferences: {
                                theme: 'dark',
                                language: 'en',
                                responseStyle: 'detailed',
                                enabledModules: ['chat', 'analysis', 'generation'],
                                customPrompts: importedData.customPrompts || {}
                            },
                            templateSettings: {
                                copyPersonality: true,
                                copyKnowledge: true,
                                copyPreferences: true,
                                defaultRoles: ['user']
                            }
                        };
                        return [4 /*yield*/, this.saveAdminCore(adminCore)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, adminCore];
                }
            });
        });
    };
    // USER ZED CORE MANAGEMENT
    ZedCoreMemoryService.prototype.getUserMemoryPath = function (userId) {
        return path_1.default.join(this.usersMemoryPath, userId, 'zed.json');
    };
    ZedCoreMemoryService.prototype.getUserSnapshotsPath = function (userId) {
        return path_1.default.join(this.usersMemoryPath, userId, 'snapshots');
    };
    ZedCoreMemoryService.prototype.getUserUploadsPath = function (userId) {
        return path_1.default.join(this.uploadsPath, userId);
    };
    ZedCoreMemoryService.prototype.getUserOutputPath = function (userId) {
        return path_1.default.join(this.outputPath, userId);
    };
    ZedCoreMemoryService.prototype.createUserZedCore = function (userId, adminId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminCore, userMemoryDir, userSnapshotsDir, userUploadsDir, userOutputDir, userCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAdminCore()];
                    case 1:
                        adminCore = _a.sent();
                        if (!adminCore) {
                            throw new Error('Admin core not found. Initialize admin core first.');
                        }
                        userMemoryDir = path_1.default.dirname(this.getUserMemoryPath(userId));
                        userSnapshotsDir = this.getUserSnapshotsPath(userId);
                        userUploadsDir = this.getUserUploadsPath(userId);
                        userOutputDir = this.getUserOutputPath(userId);
                        return [4 /*yield*/, Promise.all([
                                fs_1.promises.mkdir(userMemoryDir, { recursive: true }),
                                fs_1.promises.mkdir(userSnapshotsDir, { recursive: true }),
                                fs_1.promises.mkdir(userUploadsDir, { recursive: true }),
                                fs_1.promises.mkdir(userOutputDir, { recursive: true })
                            ])];
                    case 2:
                        _a.sent();
                        userCore = {
                            userId: userId,
                            version: '1.0.0',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            authorizedEditors: [adminId, userId],
                            baseTemplate: adminCore.version,
                            personality: {
                                baseTraits: adminCore.templateSettings.copyPersonality ? __assign({}, adminCore.basePersonality) : {},
                                learnedBehaviors: {},
                                customizations: {}
                            },
                            conversations: [],
                            uploads: [],
                            generations: [],
                            preferences: adminCore.templateSettings.copyPreferences ? __assign({}, adminCore.defaultPreferences) : {
                                theme: 'light',
                                language: 'en',
                                responseStyle: 'concise',
                                enabledModules: ['chat'],
                                customPrompts: {}
                            },
                            bookmarks: [],
                            roles: adminCore.templateSettings.defaultRoles.map(function (roleName) { return ({
                                id: (0, uuid_1.v4)(),
                                name: roleName,
                                description: "Default ".concat(roleName, " role"),
                                permissions: roleName === 'admin' ? ['*'] : ['read', 'write'],
                                assignedAt: new Date()
                            }); }),
                            memoryEntries: [],
                            compressionHistory: []
                        };
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, userCore];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.getUserCore = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var data, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs_1.promises.readFile(this.getUserMemoryPath(userId), 'utf-8')];
                    case 1:
                        data = _b.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.saveUserCore = function (userCore) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userCore.updatedAt = new Date();
                        return [4 /*yield*/, fs_1.promises.writeFile(this.getUserMemoryPath(userCore.userId), JSON.stringify(userCore, null, 2), 'utf-8')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.getOrCreateUserCore = function (userId, adminId) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!!userCore) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.createUserZedCore(userId, adminId)];
                    case 2:
                        userCore = _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, userCore];
                }
            });
        });
    };
    // MEMORY ENTRY MANAGEMENT
    ZedCoreMemoryService.prototype.addMemoryEntry = function (userId, entry) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, memoryEntry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        memoryEntry = __assign(__assign({ id: (0, uuid_1.v4)() }, entry), { timestamp: new Date() });
                        userCore.memoryEntries.push(memoryEntry);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, memoryEntry.id];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.addConversation = function (userId, conversation) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, newConversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        newConversation = __assign(__assign({ id: (0, uuid_1.v4)() }, conversation), { createdAt: new Date(), updatedAt: new Date() });
                        userCore.conversations.push(newConversation);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, newConversation.id];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.updateConversation = function (userId, conversationId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, conversationIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        conversationIndex = userCore.conversations.findIndex(function (c) { return c.id === conversationId; });
                        if (conversationIndex === -1) {
                            throw new Error('Conversation not found');
                        }
                        userCore.conversations[conversationIndex] = __assign(__assign(__assign({}, userCore.conversations[conversationIndex]), updates), { updatedAt: new Date() });
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.addUpload = function (userId, uploadData) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, uploadId, uploadPath, upload;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        uploadId = (0, uuid_1.v4)();
                        uploadPath = path_1.default.join(this.getUserUploadsPath(userId), uploadId + path_1.default.extname(uploadData.filename));
                        upload = {
                            id: uploadId,
                            filename: uploadData.filename,
                            path: uploadPath,
                            type: uploadData.type,
                            uploadedAt: new Date(),
                            metadata: uploadData.metadata
                        };
                        userCore.uploads.push(upload);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, uploadId];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.addGeneration = function (userId, generation) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, generationId, filename, generationPath, generationEntry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        generationId = (0, uuid_1.v4)();
                        filename = "".concat(generationId, ".").concat(generation.type === 'document' ? 'md' :
                            generation.type === 'code' ? 'txt' :
                                generation.type === 'image' ? 'png' : 'json');
                        generationPath = path_1.default.join(this.getUserOutputPath(userId), filename);
                        // Save the generated content to file
                        return [4 /*yield*/, fs_1.promises.writeFile(generationPath, typeof generation.content === 'string' ? generation.content : JSON.stringify(generation.content, null, 2), 'utf-8')];
                    case 2:
                        // Save the generated content to file
                        _a.sent();
                        generationEntry = {
                            id: generationId,
                            type: generation.type,
                            title: generation.title,
                            path: generationPath,
                            generatedAt: new Date(),
                            prompt: generation.prompt,
                            metadata: generation.metadata
                        };
                        userCore.generations.push(generationEntry);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, generationId];
                }
            });
        });
    };
    // PREFERENCES MANAGEMENT
    ZedCoreMemoryService.prototype.updatePreferences = function (userId, preferences) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        userCore.preferences = __assign(__assign({}, userCore.preferences), preferences);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // BOOKMARKS MANAGEMENT
    ZedCoreMemoryService.prototype.addBookmark = function (userId, bookmark) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, bookmarkEntry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        bookmarkEntry = __assign(__assign({ id: (0, uuid_1.v4)() }, bookmark), { createdAt: new Date() });
                        userCore.bookmarks.push(bookmarkEntry);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, bookmarkEntry.id];
                }
            });
        });
    };
    // AUTHORIZATION
    ZedCoreMemoryService.prototype.isAuthorizedEditor = function (userId, editorId) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, userCore.authorizedEditors.includes(editorId)];
                }
            });
        });
    };
    ZedCoreMemoryService.prototype.addAuthorizedEditor = function (userId, editorId, requesterId) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        if (!userCore.authorizedEditors.includes(requesterId)) {
                            throw new Error('Unauthorized to add editors');
                        }
                        if (!!userCore.authorizedEditors.includes(editorId)) return [3 /*break*/, 3];
                        userCore.authorizedEditors.push(editorId);
                        return [4 /*yield*/, this.saveUserCore(userCore)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // MEMORY STATISTICS
    ZedCoreMemoryService.prototype.getMemoryStats = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var userCore, memorySize, lastCompression;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getUserCore(userId)];
                    case 1:
                        userCore = _a.sent();
                        if (!userCore) {
                            throw new Error('User core not found');
                        }
                        memorySize = JSON.stringify(userCore).length;
                        lastCompression = userCore.compressionHistory.length > 0 ?
                            userCore.compressionHistory[userCore.compressionHistory.length - 1].compressedAt : undefined;
                        return [2 /*return*/, {
                                totalEntries: userCore.memoryEntries.length,
                                totalConversations: userCore.conversations.length,
                                totalUploads: userCore.uploads.length,
                                totalGenerations: userCore.generations.length,
                                totalBookmarks: userCore.bookmarks.length,
                                memorySize: memorySize,
                                lastCompression: lastCompression
                            }];
                }
            });
        });
    };
    // LIST ALL USERS (Admin only)
    ZedCoreMemoryService.prototype.getAllUserIds = function () {
        return __awaiter(this, void 0, void 0, function () {
            var userDirs, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs_1.promises.readdir(this.usersMemoryPath)];
                    case 1:
                        userDirs = _b.sent();
                        return [2 /*return*/, userDirs.filter(function (dir) { return __awaiter(_this, void 0, void 0, function () {
                                var userMemoryFile, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            userMemoryFile = path_1.default.join(this.usersMemoryPath, dir, 'zed.json');
                                            _b.label = 1;
                                        case 1:
                                            _b.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, fs_1.promises.access(userMemoryFile)];
                                        case 2:
                                            _b.sent();
                                            return [2 /*return*/, true];
                                        case 3:
                                            _a = _b.sent();
                                            return [2 /*return*/, false];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return ZedCoreMemoryService;
}());
exports.zedCoreMemoryService = new ZedCoreMemoryService();
