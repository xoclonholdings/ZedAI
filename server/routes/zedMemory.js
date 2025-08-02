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
var express_1 = require("express");
var multer_1 = require("multer");
var path_1 = require("path");
var fs_1 = require("fs");
var zedCoreMemory_js_1 = require("../services/zedCoreMemory.js");
var memoryCompressor_js_1 = require("../services/memoryCompressor.js");
var memoryImporter_js_1 = require("../services/memoryImporter.js");
var router = (0, express_1.Router)();
// Multer configuration for file uploads
var storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) { return __awaiter(void 0, void 0, void 0, function () {
        var userId, uploadPath;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    userId = req.body.userId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
                    if (!userId) {
                        return [2 /*return*/, cb(new Error('User ID required'), '')];
                    }
                    uploadPath = path_1.default.join(process.cwd(), 'user_uploads', userId);
                    return [4 /*yield*/, fs_1.promises.mkdir(uploadPath, { recursive: true })];
                case 1:
                    _b.sent();
                    cb(null, uploadPath);
                    return [2 /*return*/];
            }
        });
    }); },
    filename: function (req, file, cb) {
        var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
var upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: function (req, file, cb) {
        // Allow common file types
        var allowedTypes = /jpeg|jpg|png|gif|pdf|txt|md|json|csv|xlsx|docx/;
        var extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        var mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
// Middleware to check authorization
var checkAuth = function (req, res, next) {
    var _a;
    var userId = req.params.userId || req.body.userId;
    var requesterId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || req.headers['x-user-id'];
    if (!requesterId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.requesterId = requesterId;
    req.targetUserId = userId;
    next();
};
var checkEditPermission = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, isAuthorized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                if (targetUserId === requesterId) {
                    return [2 /*return*/, next()]; // User can edit their own memory
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId)];
            case 1:
                isAuthorized = _a.sent();
                if (!isAuthorized) {
                    return [2 /*return*/, res.status(403).json({ error: 'Not authorized to edit this memory' })];
                }
                next();
                return [2 /*return*/];
        }
    });
}); };
// === CORE MEMORY ROUTES ===
// Initialize admin core from imported data
router.post('/admin/initialize', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var importedData, adminCore, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                importedData = req.body.importedData;
                if (!importedData) {
                    return [2 /*return*/, res.status(400).json({ error: 'Imported data required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.initializeAdminCoreFromImport(importedData)];
            case 1:
                adminCore = _a.sent();
                res.json({ success: true, adminCore: adminCore });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Error initializing admin core:', error_1);
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get admin core (read-only for non-admins)
router.get('/admin', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var adminCore, isAdmin, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getAdminCore()];
            case 1:
                adminCore = _a.sent();
                if (!adminCore) {
                    return [2 /*return*/, res.status(404).json({ error: 'Admin core not found' })];
                }
                isAdmin = req.requesterId === 'admin';
                if (isAdmin) {
                    res.json(adminCore);
                }
                else {
                    res.json({
                        version: adminCore.version,
                        basePersonality: adminCore.basePersonality,
                        defaultModules: adminCore.defaultModules,
                        defaultPreferences: adminCore.defaultPreferences
                    });
                }
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('Error getting admin core:', error_2);
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get or create user ZED core
router.get('/:userId', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, userCore, canView, _a, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getUserCore(targetUserId)];
            case 1:
                userCore = _b.sent();
                if (!!userCore) return [3 /*break*/, 3];
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.createUserZedCore(targetUserId, requesterId)];
            case 2:
                // Create new user core
                userCore = _b.sent();
                _b.label = 3;
            case 3:
                _a = targetUserId === requesterId;
                if (_a) return [3 /*break*/, 5];
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId)];
            case 4:
                _a = (_b.sent());
                _b.label = 5;
            case 5:
                canView = _a;
                if (!canView) {
                    return [2 /*return*/, res.status(403).json({ error: 'Not authorized to view this memory' })];
                }
                res.json(userCore);
                return [3 /*break*/, 7];
            case 6:
                error_3 = _b.sent();
                console.error('Error getting user core:', error_3);
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// Save memory entry
router.post('/save', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, _a, type, content, metadata, entryId, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                _a = req.body, type = _a.type, content = _a.content, metadata = _a.metadata;
                if (!type || !content) {
                    return [2 /*return*/, res.status(400).json({ error: 'Type and content required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addMemoryEntry(targetUserId, {
                        type: type,
                        content: content,
                        metadata: metadata
                    })];
            case 1:
                entryId = _b.sent();
                res.json({ success: true, entryId: entryId });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                console.error('Error saving memory entry:', error_4);
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Add conversation
router.post('/:userId/conversations', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, _a, route, title, messages, conversationId, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                _a = req.body, route = _a.route, title = _a.title, messages = _a.messages;
                if (!route || !title || !messages) {
                    return [2 /*return*/, res.status(400).json({ error: 'Route, title, and messages required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addConversation(targetUserId, {
                        route: route,
                        title: title,
                        messages: messages
                    })];
            case 1:
                conversationId = _b.sent();
                res.json({ success: true, conversationId: conversationId });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _b.sent();
                console.error('Error adding conversation:', error_5);
                res.status(500).json({ error: error_5.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Update conversation
router.put('/:userId/conversations/:conversationId', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, conversationId, updates, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                conversationId = req.params.conversationId;
                updates = req.body;
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.updateConversation(targetUserId, conversationId, updates)];
            case 1:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                console.error('Error updating conversation:', error_6);
                res.status(500).json({ error: error_6.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Upload file
router.post('/:userId/upload', checkAuth, checkEditPermission, upload.single('file'), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, uploadId, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                if (!req.file) {
                    return [2 /*return*/, res.status(400).json({ error: 'No file uploaded' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addUpload(targetUserId, {
                        filename: req.file.originalname,
                        type: req.file.mimetype,
                        metadata: {
                            size: req.file.size,
                            encoding: req.file.encoding
                        }
                    })];
            case 1:
                uploadId = _a.sent();
                res.json({
                    success: true,
                    uploadId: uploadId,
                    filename: req.file.originalname,
                    size: req.file.size
                });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                console.error('Error uploading file:', error_7);
                res.status(500).json({ error: error_7.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Add generation
router.post('/:userId/generations', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, _a, type, title, content, prompt_1, metadata, generationId, error_8;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                _a = req.body, type = _a.type, title = _a.title, content = _a.content, prompt_1 = _a.prompt, metadata = _a.metadata;
                if (!type || !title || !content || !prompt_1) {
                    return [2 /*return*/, res.status(400).json({ error: 'Type, title, content, and prompt required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addGeneration(targetUserId, {
                        type: type,
                        title: title,
                        content: content,
                        prompt: prompt_1,
                        metadata: metadata
                    })];
            case 1:
                generationId = _b.sent();
                res.json({ success: true, generationId: generationId });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _b.sent();
                console.error('Error adding generation:', error_8);
                res.status(500).json({ error: error_8.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Update preferences
router.put('/:userId/preferences', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, preferences, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                preferences = req.body;
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.updatePreferences(targetUserId, preferences)];
            case 1:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                console.error('Error updating preferences:', error_9);
                res.status(500).json({ error: error_9.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Add bookmark
router.post('/:userId/bookmarks', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, _a, title, url, content, tags, bookmarkId, error_10;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                _a = req.body, title = _a.title, url = _a.url, content = _a.content, tags = _a.tags;
                if (!title || (!url && !content)) {
                    return [2 /*return*/, res.status(400).json({ error: 'Title and either URL or content required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addBookmark(targetUserId, {
                        title: title,
                        url: url,
                        content: content,
                        tags: tags || []
                    })];
            case 1:
                bookmarkId = _b.sent();
                res.json({ success: true, bookmarkId: bookmarkId });
                return [3 /*break*/, 3];
            case 2:
                error_10 = _b.sent();
                console.error('Error adding bookmark:', error_10);
                res.status(500).json({ error: error_10.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get memory statistics
router.get('/:userId/stats', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, canView, _a, stats, error_11;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                _a = targetUserId === requesterId;
                if (_a) return [3 /*break*/, 2];
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                canView = _a;
                if (!canView) {
                    return [2 /*return*/, res.status(403).json({ error: 'Not authorized to view stats' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getMemoryStats(targetUserId)];
            case 3:
                stats = _b.sent();
                res.json(stats);
                return [3 /*break*/, 5];
            case 4:
                error_11 = _b.sent();
                console.error('Error getting memory stats:', error_11);
                res.status(500).json({ error: error_11.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// === COMPRESSION ROUTES ===
// Trigger compression for user
router.post('/:userId/compress', checkAuth, checkEditPermission, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, snapshot, error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                return [4 /*yield*/, memoryCompressor_js_1.memoryCompressorService.triggerCompressionForUser(targetUserId)];
            case 1:
                snapshot = _a.sent();
                res.json({ success: true, snapshot: snapshot });
                return [3 /*break*/, 3];
            case 2:
                error_12 = _a.sent();
                console.error('Error compressing memory:', error_12);
                res.status(500).json({ error: error_12.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Get compression snapshots
router.get('/:userId/snapshots', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, canView, _a, snapshots, error_13;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                _a = targetUserId === requesterId;
                if (_a) return [3 /*break*/, 2];
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                canView = _a;
                if (!canView) {
                    return [2 /*return*/, res.status(403).json({ error: 'Not authorized to view snapshots' })];
                }
                return [4 /*yield*/, memoryCompressor_js_1.memoryCompressorService.getCompressionSnapshots(targetUserId)];
            case 3:
                snapshots = _b.sent();
                res.json(snapshots);
                return [3 /*break*/, 5];
            case 4:
                error_13 = _b.sent();
                console.error('Error getting compression snapshots:', error_13);
                res.status(500).json({ error: error_13.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Get compression analytics
router.get('/:userId/analytics', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, canView, _a, analytics, error_14;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                _a = targetUserId === requesterId;
                if (_a) return [3 /*break*/, 2];
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                canView = _a;
                if (!canView) {
                    return [2 /*return*/, res.status(403).json({ error: 'Not authorized to view analytics' })];
                }
                return [4 /*yield*/, memoryCompressor_js_1.memoryCompressorService.getCompressionAnalytics(targetUserId)];
            case 3:
                analytics = _b.sent();
                res.json(analytics);
                return [3 /*break*/, 5];
            case 4:
                error_14 = _b.sent();
                console.error('Error getting compression analytics:', error_14);
                res.status(500).json({ error: error_14.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// === ADMIN ROUTES ===
// Get all users (admin only)
router.get('/admin/users', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userIds, error_15;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.getAllUserIds()];
            case 1:
                userIds = _a.sent();
                res.json(userIds);
                return [3 /*break*/, 3];
            case 2:
                error_15 = _a.sent();
                console.error('Error getting all users:', error_15);
                res.status(500).json({ error: error_15.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Trigger compression for all users (admin only)
router.post('/admin/compress-all', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var snapshots, error_16;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, memoryCompressor_js_1.memoryCompressorService.triggerCompressionForAllUsers()];
            case 1:
                snapshots = _a.sent();
                res.json({ success: true, snapshots: snapshots });
                return [3 /*break*/, 3];
            case 2:
                error_16 = _a.sent();
                console.error('Error compressing all memories:', error_16);
                res.status(500).json({ error: error_16.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Add authorized editor
router.post('/:userId/editors', checkAuth, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, requesterId, editorId, error_17;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId, requesterId = req.requesterId;
                editorId = req.body.editorId;
                if (!editorId) {
                    return [2 /*return*/, res.status(400).json({ error: 'Editor ID required' })];
                }
                return [4 /*yield*/, zedCoreMemory_js_1.zedCoreMemoryService.addAuthorizedEditor(targetUserId, editorId, requesterId)];
            case 1:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                error_17 = _a.sent();
                console.error('Error adding authorized editor:', error_17);
                res.status(500).json({ error: error_17.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// === IMPORT ROUTES ===
// Import OpenAI data for user
router.post('/:userId/import', checkAuth, checkEditPermission, upload.any(), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var targetUserId, importResult, error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                targetUserId = req.targetUserId;
                if (!req.files || req.files.length === 0) {
                    return [2 /*return*/, res.status(400).json({ error: 'No files uploaded for import' })];
                }
                return [4 /*yield*/, memoryImporter_js_1.memoryImporter.importUserData(targetUserId, req.files)];
            case 1:
                importResult = _a.sent();
                res.json({ success: true, importResult: importResult });
                return [3 /*break*/, 3];
            case 2:
                error_18 = _a.sent();
                console.error('Error importing user data:', error_18);
                res.status(500).json({ error: error_18.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
