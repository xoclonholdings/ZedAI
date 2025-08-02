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
var promises_1 = require("fs/promises");
var memoryImporter_1 = require("../services/memoryImporter");
var personalityLoader_1 = require("../services/personalityLoader");
var router = express_1.default.Router();
// Configure multer for file uploads
var upload = (0, multer_1.default)({
    dest: 'uploads/memory-imports/',
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.endsWith('.zip')) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    }
});
/**
 * POST /api/memory/import
 * Import OpenAI data export (Admin only)
 */
router.post('/import', upload.single('export'), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, extractPath, execSync, personalityData, stats, error_1, cleanupError_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 7, , 12]);
                user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
                if (!user || user.accessLevel !== 'admin') {
                    return [2 /*return*/, res.status(403).json({
                            error: 'Admin access required for memory import'
                        })];
                }
                if (!req.file) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'No export file provided'
                        })];
                }
                console.log("[MEMORY IMPORT] Starting import process for file: ".concat(req.file.originalname));
                extractPath = path_1.default.join('uploads/memory-imports/extracted', Date.now().toString());
                return [4 /*yield*/, promises_1.default.mkdir(extractPath, { recursive: true })];
            case 1:
                _b.sent();
                execSync = require('child_process').execSync;
                execSync("unzip -q \"".concat(req.file.path, "\" -d \"").concat(extractPath, "\""));
                return [4 /*yield*/, memoryImporter_1.MemoryImporter.importOpenAIExport(extractPath)];
            case 2:
                personalityData = _b.sent();
                // Save to ZED memory system
                return [4 /*yield*/, memoryImporter_1.MemoryImporter.saveToZEDMemory(personalityData, true)];
            case 3:
                // Save to ZED memory system
                _b.sent();
                // Clean up temporary files
                return [4 /*yield*/, promises_1.default.rm(req.file.path)];
            case 4:
                // Clean up temporary files
                _b.sent();
                return [4 /*yield*/, promises_1.default.rm(extractPath, { recursive: true })];
            case 5:
                _b.sent();
                return [4 /*yield*/, personalityLoader_1.PersonalityLoader.getPersonalityStats()];
            case 6:
                stats = _b.sent();
                res.json({
                    success: true,
                    message: 'OpenAI export imported successfully',
                    stats: {
                        contextualMemoryCount: stats.contextualMemoryCount,
                        interactionHistoryCount: stats.interactionHistoryCount,
                        knowledgeDomainCount: stats.knowledgeDomainCount,
                        importDate: new Date().toISOString()
                    }
                });
                return [3 /*break*/, 12];
            case 7:
                error_1 = _b.sent();
                console.error('[MEMORY IMPORT] Import failed:', error_1);
                if (!req.file) return [3 /*break*/, 11];
                _b.label = 8;
            case 8:
                _b.trys.push([8, 10, , 11]);
                return [4 /*yield*/, promises_1.default.rm(req.file.path)];
            case 9:
                _b.sent();
                return [3 /*break*/, 11];
            case 10:
                cleanupError_1 = _b.sent();
                console.error('[MEMORY IMPORT] Cleanup error:', cleanupError_1);
                return [3 /*break*/, 11];
            case 11:
                res.status(500).json({
                    error: 'Failed to import memory data',
                    details: error_1 instanceof Error ? error_1.message : 'Unknown error'
                });
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/memory/import-folder
 * Import from extracted folder (Admin only)
 */
router.post('/import-folder', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, folderPath, error_2, personalityData, stats, error_3;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
                if (!user || user.accessLevel !== 'admin') {
                    return [2 /*return*/, res.status(403).json({
                            error: 'Admin access required for memory import'
                        })];
                }
                folderPath = req.body.folderPath;
                if (!folderPath) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Folder path is required'
                        })];
                }
                console.log("[MEMORY IMPORT] Starting folder import from: ".concat(folderPath));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, promises_1.default.access(folderPath)];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                error_2 = _b.sent();
                return [2 /*return*/, res.status(400).json({
                        error: 'Folder path does not exist or is not accessible'
                    })];
            case 4: return [4 /*yield*/, memoryImporter_1.MemoryImporter.importOpenAIExport(folderPath)];
            case 5:
                personalityData = _b.sent();
                // Save to ZED memory system
                return [4 /*yield*/, memoryImporter_1.MemoryImporter.saveToZEDMemory(personalityData, true)];
            case 6:
                // Save to ZED memory system
                _b.sent();
                return [4 /*yield*/, personalityLoader_1.PersonalityLoader.getPersonalityStats()];
            case 7:
                stats = _b.sent();
                res.json({
                    success: true,
                    message: 'Memory data imported successfully from folder',
                    stats: {
                        contextualMemoryCount: stats.contextualMemoryCount,
                        interactionHistoryCount: stats.interactionHistoryCount,
                        knowledgeDomainCount: stats.knowledgeDomainCount,
                        importDate: new Date().toISOString()
                    }
                });
                return [3 /*break*/, 9];
            case 8:
                error_3 = _b.sent();
                console.error('[MEMORY IMPORT] Folder import failed:', error_3);
                res.status(500).json({
                    error: 'Failed to import memory data from folder',
                    details: error_3 instanceof Error ? error_3.message : 'Unknown error'
                });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/memory/stats
 * Get personality and memory statistics
 */
router.get('/stats', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var stats, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, personalityLoader_1.PersonalityLoader.getPersonalityStats()];
            case 1:
                stats = _a.sent();
                res.json(stats);
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                console.error('[MEMORY STATS] Error getting stats:', error_4);
                res.status(500).json({
                    error: 'Failed to get memory statistics'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/memory/toggle-personality
 * Toggle between enhanced and standard personality (Admin only)
 */
router.post('/toggle-personality', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, personalityMode;
    var _a;
    return __generator(this, function (_b) {
        try {
            user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
            if (!user || user.accessLevel !== 'admin') {
                return [2 /*return*/, res.status(403).json({
                        error: 'Admin access required'
                    })];
            }
            personalityMode = req.body.personalityMode;
            if (!personalityMode || !['enhanced', 'standard'].includes(personalityMode)) {
                return [2 /*return*/, res.status(400).json({
                        error: 'Invalid personality mode. Must be "enhanced" or "standard"'
                    })];
            }
            // Update user session
            req.session.user.personalityMode = personalityMode;
            res.json({
                success: true,
                message: "Personality mode switched to ".concat(personalityMode),
                currentMode: personalityMode
            });
        }
        catch (error) {
            console.error('[MEMORY TOGGLE] Error toggling personality:', error);
            res.status(500).json({
                error: 'Failed to toggle personality mode'
            });
        }
        return [2 /*return*/];
    });
}); });
/**
 * DELETE /api/memory/admin-personality
 * Delete admin personality data (Admin only)
 */
router.delete('/admin-personality', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, MemoryService, adminKeys, _i, adminKeys_1, key, error_5, chunkIndex, error_6, error_7;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 15, , 16]);
                user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
                if (!user || user.accessLevel !== 'admin') {
                    return [2 /*return*/, res.status(403).json({
                            error: 'Admin access required'
                        })];
                }
                return [4 /*yield*/, Promise.resolve().then(function () { return require('../services/memoryService'); })];
            case 1:
                MemoryService = (_b.sent()).MemoryService;
                adminKeys = [
                    'admin_zed_personality',
                    'admin_communication_style',
                    'admin_knowledge_domains',
                    'admin_response_patterns',
                    'admin_import_metadata'
                ];
                _i = 0, adminKeys_1 = adminKeys;
                _b.label = 2;
            case 2:
                if (!(_i < adminKeys_1.length)) return [3 /*break*/, 7];
                key = adminKeys_1[_i];
                _b.label = 3;
            case 3:
                _b.trys.push([3, 5, , 6]);
                // Since deleteCoreMemory doesn't exist, we'll set to null/empty
                return [4 /*yield*/, MemoryService.setCoreMemory(key, '')];
            case 4:
                // Since deleteCoreMemory doesn't exist, we'll set to null/empty
                _b.sent();
                return [3 /*break*/, 6];
            case 5:
                error_5 = _b.sent();
                console.warn("[MEMORY DELETE] Key ".concat(key, " not found or already deleted"));
                return [3 /*break*/, 6];
            case 6:
                _i++;
                return [3 /*break*/, 2];
            case 7:
                chunkIndex = 0;
                _b.label = 8;
            case 8:
                if (!(chunkIndex < 20)) return [3 /*break*/, 14];
                _b.label = 9;
            case 9:
                _b.trys.push([9, 12, , 13]);
                return [4 /*yield*/, MemoryService.setCoreMemory("admin_contextual_memory_".concat(chunkIndex), '')];
            case 10:
                _b.sent();
                return [4 /*yield*/, MemoryService.setCoreMemory("admin_interaction_history_".concat(chunkIndex), '')];
            case 11:
                _b.sent();
                chunkIndex++;
                return [3 /*break*/, 13];
            case 12:
                error_6 = _b.sent();
                console.warn("[MEMORY DELETE] Chunk ".concat(chunkIndex, " not found"));
                chunkIndex++;
                return [3 /*break*/, 13];
            case 13: return [3 /*break*/, 8];
            case 14:
                res.json({
                    success: true,
                    message: 'Admin personality data deleted successfully'
                });
                return [3 /*break*/, 16];
            case 15:
                error_7 = _b.sent();
                console.error('[MEMORY DELETE] Error deleting admin personality:', error_7);
                res.status(500).json({
                    error: 'Failed to delete admin personality data'
                });
                return [3 /*break*/, 16];
            case 16: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
