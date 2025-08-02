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
exports.storage = exports.DatabaseStorage = void 0;
var db_1 = require("./db");
var schema_1 = require("@shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
var crypto_1 = require("crypto");
// Enhanced cache system
var MemoryCache = /** @class */ (function () {
    function MemoryCache() {
        this.cache = new Map();
        this.maxSize = 1000;
        this.ttl = 300000; // 5 minutes
    }
    MemoryCache.prototype.get = function (key) {
        var item = this.cache.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        item.hits++;
        return item.data;
    };
    MemoryCache.prototype.set = function (key, data, ttl) {
        if (this.cache.size >= this.maxSize) {
            // Remove least recently used items
            var sorted = Array.from(this.cache.entries()).sort(function (a, b) { return a[1].hits - b[1].hits; });
            for (var i = 0; i < Math.floor(this.maxSize * 0.1); i++) {
                this.cache.delete(sorted[i][0]);
            }
        }
        this.cache.set(key, {
            data: data,
            expires: Date.now() + (ttl || this.ttl),
            hits: 0,
        });
    };
    MemoryCache.prototype.delete = function (key) {
        this.cache.delete(key);
    };
    MemoryCache.prototype.clearPattern = function (pattern) {
        var _this = this;
        var regex = new RegExp(pattern.replace("*", ".*"));
        Array.from(this.cache.keys()).forEach(function (key) {
            if (regex.test(key)) {
                _this.cache.delete(key);
            }
        });
    };
    MemoryCache.prototype.clear = function () {
        this.cache.clear();
    };
    MemoryCache.prototype.getStats = function () {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: Array.from(this.cache.values()).reduce(function (sum, item) { return sum + item.hits; }, 0),
        };
    };
    return MemoryCache;
}());
var memoryCache = new MemoryCache();
var DatabaseStorage = /** @class */ (function () {
    function DatabaseStorage() {
    }
    DatabaseStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = this.generateCacheKey("getUser", id);
                        cached = memoryCache.get(cacheKey);
                        if (cached)
                            return [2 /*return*/, cached];
                        return [4 /*yield*/, db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1)];
                    case 1:
                        user = _a.sent();
                        if (user.length > 0) {
                            memoryCache.set(cacheKey, user[0]);
                            return [2 /*return*/, user[0]];
                        }
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    DatabaseStorage.prototype.getUserByUsername = function (username) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.upsertUser = function (user) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createUser = function (userData) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getAllUsers = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.updateUser = function (id, userData) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.deleteUser = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getConversation = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getConversationsByUser = function (userId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createConversation = function (conversation) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.updateConversation = function (id, updates) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.deleteConversation = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getMessagesByConversation = function (conversationId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createMessage = function (message) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.deleteMessage = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.batchCreateMessages = function (messages) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getFile = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getFilesByConversation = function (conversationId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createFile = function (file) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.updateFile = function (id, updates) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.deleteFile = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.storeFileChunk = function (fileId, chunkIndex, chunkData, chunkSize) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getFileChunks = function (fileId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getSession = function (conversationId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createSession = function (session) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.updateSession = function (id, updates) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getCoreMemoryByKey = function (key) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.upsertCoreMemory = function (data) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getAllCoreMemory = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getProjectMemoryByUser = function (userId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createProjectMemory = function (data) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.updateProjectMemory = function (id, updates) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.deleteProjectMemory = function (id) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getScratchpadMemoryByUser = function (userId) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.createScratchpadMemory = function (data) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.cleanupExpiredScratchpadMemory = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.searchConversations = function (userId, query) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getRecentActivity = function (userId, limit) {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.cleanupExpiredData = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.getCacheStats = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.optimizeStorage = function () {
        throw new Error("Method not implemented.");
    };
    DatabaseStorage.prototype.generateCacheKey = function (operation) {
        var params = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            params[_i - 1] = arguments[_i];
        }
        return (0, crypto_1.createHash)("md5").update("".concat(operation, ":").concat(JSON.stringify(params))).digest("hex");
    };
    DatabaseStorage.prototype.trackAnalytics = function (userId, eventType, eventData, duration) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, db_1.db.insert(schema_1.analytics).values({
                                userId: userId,
                                eventType: eventType,
                                eventData: eventData,
                                duration: duration,
                                sessionId: "session_".concat(Date.now()),
                                metadata: { timestamp: new Date().toISOString() },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.warn("[ANALYTICS] Failed to track event:", error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return DatabaseStorage;
}());
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
