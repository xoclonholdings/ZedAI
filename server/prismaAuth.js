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
exports.prisma = exports.getCurrentUser = exports.prismaLogin = exports.prismaAuth = void 0;
exports.setupPrismaAuth = setupPrismaAuth;
var prisma_1 = require("./prisma");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return prisma_1.prisma; } });
// Authentication middleware using Prisma
var prismaAuth = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var session, user, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                session = req.session;
                if (!(session === null || session === void 0 ? void 0 : session.userId)) {
                    return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: session.userId }
                    })];
            case 2:
                user = _a.sent();
                if (!user) {
                    req.session.destroy(function () { });
                    return [2 /*return*/, res.status(401).json({ message: "User not found" })];
                }
                // Attach user to request
                req.user = {
                    claims: {
                        sub: user.id,
                        email: user.email
                    }
                };
                next();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error("Auth middleware error:", error_1);
                return [2 /*return*/, res.status(500).json({ message: "Authentication error" })];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.prismaAuth = prismaAuth;
// Login endpoint using Prisma
var prismaLogin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, username, password, user, validPassword, authenticatedUser, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, username = _a.username, password = _a.password;
                if (!username || !password) {
                    return [2 /*return*/, res.status(400).json({ error: "Username and password required" })];
                }
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { email: username }
                    })];
            case 1:
                user = _b.sent();
                if (!user) {
                    return [2 /*return*/, res.status(401).json({ error: "Invalid credentials" })];
                }
                validPassword = (username === 'admin@zed.local' && password === 'Zed2025') ||
                    (username === 'demo@zed.local' && password === 'demo123');
                if (!validPassword) {
                    return [2 /*return*/, res.status(401).json({ error: "Invalid credentials" })];
                }
                // Create session
                if (req.session) {
                    req.session.userId = user.id;
                    req.session.user = {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    };
                }
                authenticatedUser = {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                };
                res.json({
                    success: true,
                    user: authenticatedUser
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                console.error("Login error:", error_2);
                res.status(500).json({ error: "Login failed" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.prismaLogin = prismaLogin;
// Get current user endpoint
var getCurrentUser = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var session, user, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                session = req.session;
                if (!(session === null || session === void 0 ? void 0 : session.userId)) {
                    return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
                }
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { id: session.userId },
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            profileImageUrl: true,
                            createdAt: true
                        }
                    })];
            case 1:
                user = _a.sent();
                if (!user) {
                    return [2 /*return*/, res.status(401).json({ message: "User not found" })];
                }
                res.json(user);
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error("Get user error:", error_3);
                res.status(500).json({ message: "Failed to get user" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getCurrentUser = getCurrentUser;
// Setup function to initialize database connection and create default users
function setupPrismaAuth(app) {
    return __awaiter(this, void 0, void 0, function () {
        var connected, adminUser, demoUser, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, prisma_1.testDatabaseConnection)()];
                case 1:
                    connected = _a.sent();
                    if (!connected) {
                        console.error("[PRISMA] Failed to connect to database");
                        return [2 /*return*/, false];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 9, , 10]);
                    return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                            where: { email: 'admin@zed.local' }
                        })];
                case 3:
                    adminUser = _a.sent();
                    if (!!adminUser) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma_1.prisma.user.create({
                            data: {
                                id: 'admin_user_001',
                                email: 'admin@zed.local',
                                firstName: 'Admin',
                                lastName: 'User',
                            }
                        })];
                case 4:
                    _a.sent();
                    console.log('[PRISMA] Default admin user created');
                    _a.label = 5;
                case 5: return [4 /*yield*/, prisma_1.prisma.user.findUnique({
                        where: { email: 'demo@zed.local' }
                    })];
                case 6:
                    demoUser = _a.sent();
                    if (!!demoUser) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma_1.prisma.user.create({
                            data: {
                                id: 'demo_user_001',
                                email: 'demo@zed.local',
                                firstName: 'Demo',
                                lastName: 'User',
                            }
                        })];
                case 7:
                    _a.sent();
                    console.log('[PRISMA] Demo user created');
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_4 = _a.sent();
                    console.error('[PRISMA] Error creating default users:', error_4);
                    return [3 /*break*/, 10];
                case 10:
                    // Setup auth routes
                    app.post("/api/prisma/login", exports.prismaLogin);
                    app.get("/api/prisma/user", exports.prismaAuth, exports.getCurrentUser);
                    return [2 /*return*/, true];
            }
        });
    });
}
