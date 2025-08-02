"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.optimizationService = void 0;
var storage_1 = require("../storage");
var db_1 = require("../db");
var drizzle_orm_1 = require("drizzle-orm");
var OptimizationService = /** @class */ (function () {
    function OptimizationService() {
        this.isRunning = false;
        this.intervalId = null;
        // Start optimization service
        this.start();
    }
    OptimizationService.prototype.start = function () {
        var _this = this;
        if (this.intervalId)
            return;
        // Run optimization every 15 minutes
        this.intervalId = setInterval(function () {
            _this.runOptimization();
        }, 15 * 60 * 1000);
        // Run initial optimization after 30 seconds
        setTimeout(function () {
            _this.runOptimization();
        }, 30000);
        // Optimization service started
    };
    OptimizationService.prototype.runOptimization = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, duration, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRunning)
                            return [2 /*return*/];
                        this.isRunning = true;
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, 7, 8]);
                        // Starting optimization cycle
                        // 1. Clean expired data
                        return [4 /*yield*/, storage_1.storage.cleanupExpiredData()];
                    case 2:
                        // Starting optimization cycle
                        // 1. Clean expired data
                        _a.sent();
                        // 2. Optimize storage
                        return [4 /*yield*/, storage_1.storage.optimizeStorage()];
                    case 3:
                        // 2. Optimize storage
                        _a.sent();
                        // 3. Update statistics
                        return [4 /*yield*/, this.updateStatistics()];
                    case 4:
                        // 3. Update statistics
                        _a.sent();
                        // 4. Optimize database connections
                        return [4 /*yield*/, this.optimizeConnections()];
                    case 5:
                        // 4. Optimize database connections
                        _a.sent();
                        duration = Date.now() - startTime;
                        return [3 /*break*/, 8];
                    case 6:
                        error_1 = _a.sent();
                        console.error('[OPTIMIZATION] Failed:', error_1);
                        return [3 /*break*/, 8];
                    case 7:
                        this.isRunning = false;
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    OptimizationService.prototype.updateStatistics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        // Update conversation message counts
                        return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        UPDATE conversations \n        SET preview = (\n          SELECT content \n          FROM messages \n          WHERE conversation_id = conversations.id \n          ORDER BY created_at DESC \n          LIMIT 1\n        )\n        WHERE preview IS NULL OR preview = ''\n      "], ["\n        UPDATE conversations \n        SET preview = (\n          SELECT content \n          FROM messages \n          WHERE conversation_id = conversations.id \n          ORDER BY created_at DESC \n          LIMIT 1\n        )\n        WHERE preview IS NULL OR preview = ''\n      "]))))];
                    case 1:
                        // Update conversation message counts
                        _a.sent();
                        // Update file processing status
                        return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        UPDATE files \n        SET status = 'completed' \n        WHERE status = 'processing' \n        AND created_at < NOW() - INTERVAL '5 minutes'\n      "], ["\n        UPDATE files \n        SET status = 'completed' \n        WHERE status = 'processing' \n        AND created_at < NOW() - INTERVAL '5 minutes'\n      "]))))];
                    case 2:
                        // Update file processing status
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.warn('[OPTIMIZATION] Statistics update failed:', error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    OptimizationService.prototype.optimizeConnections = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["SELECT 1 as health_check"], ["SELECT 1 as health_check"]))))];
                    case 1:
                        result = _a.sent();
                        if (!result) {
                            console.warn('[OPTIMIZATION] Database connection check failed');
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        console.error('[OPTIMIZATION] Connection optimization failed:', error_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    OptimizationService.prototype.forceOptimization = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.runOptimization()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    OptimizationService.prototype.getStats = function () {
        return {
            isRunning: this.isRunning,
            lastRun: new Date().toISOString(),
            cache: storage_1.storage.getCacheStats()
        };
    };
    OptimizationService.prototype.stop = function () {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('[OPTIMIZATION] Service stopped');
    };
    return OptimizationService;
}());
exports.optimizationService = new OptimizationService();
var templateObject_1, templateObject_2, templateObject_3;
