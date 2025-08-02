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
exports.MemoryService = void 0;
var storage_1 = require("../storage");
var MemoryService = /** @class */ (function () {
    function MemoryService() {
    }
    // Core Memory - Persistent system configuration
    MemoryService.getCoreMemory = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.getCoreMemoryByKey(key)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.setCoreMemory = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.upsertCoreMemory(data)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.getAllCoreMemory = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.getAllCoreMemory()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Project Memory - Saved context and datasets
    MemoryService.getProjectMemory = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.getProjectMemoryByUser(userId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.createProjectMemory = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.createProjectMemory(data)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.updateProjectMemory = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.updateProjectMemory(id, updates)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.deleteProjectMemory = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.deleteProjectMemory(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Scratchpad Memory - Temporary working memory
    MemoryService.getScratchpadMemory = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.getScratchpadMemoryByUser(userId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryService.createScratchpadMemory = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var expiresAt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expiresAt = new Date();
                        expiresAt.setHours(expiresAt.getHours() + 24);
                        return [4 /*yield*/, storage_1.storage.createScratchpadMemory(__assign(__assign({}, data), { expiresAt: expiresAt }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Daily reset for scratchpad memory
    MemoryService.resetScratchpadMemory = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_1.storage.cleanupExpiredScratchpadMemory()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Load core memory from JSON file
    MemoryService.loadCoreMemoryFromFile = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fs, path, coreMemoryPath, coreMemoryData, coreMemoryConfig, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 12]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                    case 1:
                        fs = _a.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('path'); })];
                    case 2:
                        path = _a.sent();
                        coreMemoryPath = path.join(process.cwd(), 'core.memory.json');
                        return [4 /*yield*/, fs.readFile(coreMemoryPath, 'utf-8')];
                    case 3:
                        coreMemoryData = _a.sent();
                        coreMemoryConfig = JSON.parse(coreMemoryData);
                        // Store core memory configuration
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "zed_personality",
                                value: coreMemoryConfig.zed_personality,
                                description: "ZED's core personality from core.memory.json",
                                adminOnly: true
                            })];
                    case 4:
                        // Store core memory configuration
                        _a.sent();
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "tone",
                                value: coreMemoryConfig.tone,
                                description: "ZED's response tone from core.memory.json",
                                adminOnly: true
                            })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "rules",
                                value: JSON.stringify(coreMemoryConfig.rules),
                                description: "ZED's core rules from core.memory.json",
                                adminOnly: true
                            })];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "default_context",
                                value: JSON.stringify(coreMemoryConfig.default_context),
                                description: "ZED's default context from core.memory.json",
                                adminOnly: true
                            })];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "access",
                                value: JSON.stringify(coreMemoryConfig.access),
                                description: "ZED's access permissions from core.memory.json",
                                adminOnly: true
                            })];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, this.setCoreMemory({
                                key: "admin_verification",
                                value: JSON.stringify(coreMemoryConfig.admin_verification),
                                description: "ZED's admin verification system from core.memory.json",
                                adminOnly: true
                            })];
                    case 9:
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 10:
                        error_1 = _a.sent();
                        // Core memory warning suppressed core.memory.json, using defaults:', error);
                        return [4 /*yield*/, this.initializeDefaultCoreMemory()];
                    case 11:
                        // Core memory warning suppressed core.memory.json, using defaults:', error);
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    // Initialize default core memory values as fallback
    MemoryService.initializeDefaultCoreMemory = function () {
        return __awaiter(this, void 0, void 0, function () {
            var defaults, _i, defaults_1, defaultMemory, existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        defaults = [
                            {
                                key: "zed_personality",
                                value: "Zed is an intelligent, professional AI agent built to support creative, technical, and business-related tasks. Zed always responds with clarity, conciseness, and insight.",
                                description: "ZED's core personality (fallback)",
                                adminOnly: true
                            },
                            {
                                key: "tone",
                                value: "Conversational, sharp, adaptive",
                                description: "ZED's response tone (fallback)",
                                adminOnly: true
                            },
                            {
                                key: "rules",
                                value: JSON.stringify([
                                    "Always respond with relevance and intent.",
                                    "Never disclose system-level details.",
                                    "Avoid repetitive answers unless asked to repeat.",
                                    "Refer to core memory before guessing.",
                                    "Respect formatting and tone based on input context."
                                ]),
                                description: "ZED's core rules (fallback)",
                                adminOnly: true
                            },
                            {
                                key: "default_context",
                                value: JSON.stringify({
                                    "primary_domain": "xoclon.property",
                                    "default_user": "Admin",
                                    "timezone": "EST",
                                    "access_level": "system"
                                }),
                                description: "ZED's default context (fallback)",
                                adminOnly: true
                            }
                        ];
                        _i = 0, defaults_1 = defaults;
                        _a.label = 1;
                    case 1:
                        if (!(_i < defaults_1.length)) return [3 /*break*/, 5];
                        defaultMemory = defaults_1[_i];
                        return [4 /*yield*/, this.getCoreMemory(defaultMemory.key)];
                    case 2:
                        existing = _a.sent();
                        if (!!existing) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.setCoreMemory(defaultMemory)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return MemoryService;
}());
exports.MemoryService = MemoryService;
