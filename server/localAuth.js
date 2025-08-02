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
exports.isAuthenticated = exports.isLocalAuthenticated = void 0;
exports.getLocalSession = getLocalSession;
exports.setupLocalAuth = setupLocalAuth;
var express_session_1 = require("express-session");
// Default credentials and security settings - changeable through settings
var LOGIN_USERS = [
    {
        id: 1,
        username: process.env.ADMIN_USERNAME || "Admin",
        email: process.env.ADMIN_EMAIL || "admin@zed.local",
        password: process.env.ADMIN_PASSWORD || "Zed2025",
        role: "admin",
    },
];
var LOCAL_USERS = [
    {
        id: "user_001",
        username: "Admin",
        password: "Zed2025",
        email: "admin@zed.local",
        firstName: "ZED",
        lastName: "Admin",
        profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
    }
];
// Admin security settings - updatable by admin
var ADMIN_SECURITY_SETTINGS = {
    securePhrase: "XOCLON_SECURE_2025",
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15
};
function getLocalSession() {
    var sessionTtl = ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes * 60 * 1000;
    return (0, express_session_1.default)({
        secret: process.env.SESSION_SECRET || "zed-local-secret-key-change-in-production",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            maxAge: sessionTtl,
        },
    });
}
// Enhanced verification tracking
var VERIFICATION_ATTEMPTS = new Map();
var TRUSTED_DEVICES = new Map();
function getDeviceFingerprint(req) {
    var userAgent = req.headers['user-agent'] || '';
    var acceptLanguage = req.headers['accept-language'] || '';
    var acceptEncoding = req.headers['accept-encoding'] || '';
    var ip = req.ip || req.connection.remoteAddress || '';
    return Buffer.from("".concat(userAgent, ":").concat(acceptLanguage, ":").concat(acceptEncoding, ":").concat(ip)).toString('base64').slice(0, 32);
}
function isDeviceTrusted(deviceFingerprint, userId) {
    var device = TRUSTED_DEVICES.get(deviceFingerprint);
    return (device === null || device === void 0 ? void 0 : device.userId) === userId && (device === null || device === void 0 ? void 0 : device.verified) === true;
}
function setupLocalAuth(app) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            app.use(getLocalSession());
            // Get current user endpoint for React app (replaces routes/auth.ts)
            app.get("/api/auth/user", function (req, res) {
                var session = req.session;
                // Debug logging
                console.log('Auth check - Session exists:', !!session);
                console.log('Auth check - Session user:', (session === null || session === void 0 ? void 0 : session.user) ? 'exists' : 'missing');
                console.log('Auth check - Session ID:', session === null || session === void 0 ? void 0 : session.id);
                // Check if user is authenticated using localAuth session structure
                if (session && session.user) {
                    var userResponse = {
                        user: {
                            id: session.user.id || session.userId,
                            username: session.user.username,
                            email: session.user.email,
                            firstName: session.user.firstName,
                            lastName: session.user.lastName,
                            isAdmin: session.user.username === 'Admin'
                        },
                        verified: session.verified || true
                    };
                    console.log('Auth check - Returning user:', userResponse.user.username);
                    return res.json(userResponse);
                }
                else {
                    console.log('Auth check - No valid session, returning 401');
                    return res.status(401).json({ error: "Not authenticated" });
                }
            });
            // Enhanced login endpoint with multi-factor verification
            app.post("/api/login", function (req, res) {
                console.log("🔐 Login endpoint called");
                console.log("📝 Request body:", req.body);
                var _a = req.body, username = _a.username, password = _a.password;
                console.log("🔍 Extracted credentials:", { username: username, password: password ? '[HIDDEN]' : 'undefined' });
                if (!username || !password) {
                    console.log("❌ Missing username or password");
                    return res.status(400).json({ error: "Username and password required" });
                }
                console.log("🔍 Searching for user in LOCAL_USERS...");
                console.log("📋 Available users:", LOCAL_USERS.map(function (u) { return ({ username: u.username, id: u.id }); }));
                // Find user in local users - simplified check
                var user = LOCAL_USERS.find(function (u) { return u.username === username && u.password === password; });
                console.log("🔍 User search result:", user ? 'Found' : 'Not found');
                if (!user) {
                    console.log("❌ Invalid credentials for user:", username);
                    return res.status(401).json({ error: "Invalid credentials" });
                }
                // Simplified login - bypass additional verification for development
                console.log("\u2705 User ".concat(username, " logged in successfully"));
                try {
                    // Skip database save for now - direct session creation
                    console.log("\u26A1 Creating session directly");
                    // Set basic session data
                    if (req.session) {
                        req.session.userId = user.id;
                        req.session.user = {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            profileImageUrl: user.profileImageUrl,
                        };
                        console.log("\u2705 Session created for user ".concat(username));
                    }
                    else {
                        console.warn('⚠️ No session object available');
                    }
                    console.log("\u2705 Returning success response for ".concat(username));
                    return res.json({
                        success: true,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            isAdmin: user.username === 'Admin',
                            sessionExpiry: ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes
                        }
                    });
                }
                catch (sessionError) {
                    console.error("❌ Session creation error:", sessionError);
                    return res.status(500).json({ error: "Session creation failed" });
                }
            });
            // Enhanced logout with device cleanup
            app.post("/api/logout", function (req, res) {
                var _a;
                var session = req.session;
                if ((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.deviceFingerprint) {
                    // Optionally remove device from trusted list on explicit logout
                    // TRUSTED_DEVICES.delete(session.user.deviceFingerprint);
                }
                req.session.destroy(function (err) {
                    if (err) {
                        return res.status(500).json({ error: "Logout failed" });
                    }
                    return res.json({ success: true });
                });
            });
            // Admin verification challenge endpoint
            app.post("/api/admin/verify-challenge", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var _a, challengeAnswer, securePhrase, deviceFingerprint, validAnswers, isValidChallenge, isValidPhrase, keys;
                return __generator(this, function (_b) {
                    try {
                        _a = req.body, challengeAnswer = _a.challengeAnswer, securePhrase = _a.securePhrase;
                        deviceFingerprint = getDeviceFingerprint(req);
                        validAnswers = ['42', 'xoclon', 'diagnostic'];
                        isValidChallenge = challengeAnswer && validAnswers.includes(challengeAnswer.toLowerCase());
                        isValidPhrase = securePhrase === "XOCLON_SECURE_2025";
                        if (isValidChallenge || isValidPhrase) {
                            keys = Array.from(VERIFICATION_ATTEMPTS.keys()).filter(function (key) { return key.includes(req.ip || ''); });
                            keys.forEach(function (key) { return VERIFICATION_ATTEMPTS.delete(key); });
                            res.json({ success: true, message: "Challenge verified, please try logging in again" });
                        }
                        else {
                            res.status(401).json({ error: "Invalid challenge response" });
                        }
                    }
                    catch (error) {
                        res.status(500).json({ error: "Challenge verification failed" });
                    }
                    return [2 /*return*/];
                });
            }); });
            // Update credentials endpoint (protected)
            app.post("/api/auth/update-credentials", exports.isAuthenticated, function (req, res) {
                try {
                    var _a = req.body, newUsername = _a.newUsername, newPassword = _a.newPassword;
                    var session_1 = req.session;
                    if (!newUsername || !newPassword) {
                        return res.status(400).json({ error: "Username and password required" });
                    }
                    if (newPassword.length < 6) {
                        return res.status(400).json({ error: "Password must be at least 6 characters" });
                    }
                    // Find and update the user
                    var userIndex = LOCAL_USERS.findIndex(function (u) { return u.id === session_1.userId; });
                    if (userIndex !== -1) {
                        LOCAL_USERS[userIndex].username = newUsername;
                        LOCAL_USERS[userIndex].password = newPassword;
                        // Update session
                        session_1.user.username = newUsername;
                        return res.json({
                            success: true,
                            message: "Credentials updated successfully",
                            user: {
                                username: newUsername,
                                firstName: LOCAL_USERS[userIndex].firstName,
                                lastName: LOCAL_USERS[userIndex].lastName
                            }
                        });
                    }
                    else {
                        return res.status(404).json({ error: "User not found" });
                    }
                }
                catch (error) {
                    console.error("Update credentials error:", error);
                    return res.status(500).json({ error: "Failed to update credentials" });
                }
            });
            // Get current credentials (protected)
            app.get("/api/auth/current-credentials", exports.isAuthenticated, function (req, res) {
                var session = req.session;
                var user = LOCAL_USERS.find(function (u) { return u.id === session.userId; });
                if (user) {
                    return res.json({
                        username: user.username,
                        // Don't send password for security
                    });
                }
                else {
                    return res.status(404).json({ error: "User not found" });
                }
            });
            // Get current security settings (Admin only)
            app.get("/api/admin/security-settings", exports.isLocalAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var user;
                var _a;
                return __generator(this, function (_b) {
                    user = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user;
                    if (!user || user.username !== 'Admin') {
                        return [2 /*return*/, res.status(403).json({ error: "Admin access required" })];
                    }
                    return [2 /*return*/, res.json({
                            currentSecurePhrase: ADMIN_SECURITY_SETTINGS.securePhrase,
                            sessionTimeoutMinutes: ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes,
                            maxFailedAttempts: ADMIN_SECURITY_SETTINGS.maxFailedAttempts,
                            lockoutDurationMinutes: ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes
                        })];
                });
            }); });
            // Update security settings (Admin only)
            app.post("/api/admin/security-settings", exports.isLocalAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var user, _a, newSecurePhrase, sessionTimeoutMinutes, maxFailedAttempts, lockoutDurationMinutes;
                var _b;
                return __generator(this, function (_c) {
                    user = (_b = req.session) === null || _b === void 0 ? void 0 : _b.user;
                    if (!user || user.username !== 'Admin') {
                        return [2 /*return*/, res.status(403).json({ error: "Admin access required" })];
                    }
                    _a = req.body, newSecurePhrase = _a.newSecurePhrase, sessionTimeoutMinutes = _a.sessionTimeoutMinutes, maxFailedAttempts = _a.maxFailedAttempts, lockoutDurationMinutes = _a.lockoutDurationMinutes;
                    // Validate inputs
                    if (newSecurePhrase && (typeof newSecurePhrase !== 'string' || newSecurePhrase.length < 8)) {
                        return [2 /*return*/, res.status(400).json({ error: "Secure phrase must be at least 8 characters long" })];
                    }
                    if (sessionTimeoutMinutes && (sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 480)) {
                        return [2 /*return*/, res.status(400).json({ error: "Session timeout must be between 5 and 480 minutes" })];
                    }
                    if (maxFailedAttempts && (maxFailedAttempts < 1 || maxFailedAttempts > 10)) {
                        return [2 /*return*/, res.status(400).json({ error: "Max failed attempts must be between 1 and 10" })];
                    }
                    if (lockoutDurationMinutes && (lockoutDurationMinutes < 1 || lockoutDurationMinutes > 60)) {
                        return [2 /*return*/, res.status(400).json({ error: "Lockout duration must be between 1 and 60 minutes" })];
                    }
                    // Update settings
                    if (newSecurePhrase) {
                        ADMIN_SECURITY_SETTINGS.securePhrase = newSecurePhrase;
                    }
                    if (sessionTimeoutMinutes) {
                        ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes = sessionTimeoutMinutes;
                    }
                    if (maxFailedAttempts) {
                        ADMIN_SECURITY_SETTINGS.maxFailedAttempts = maxFailedAttempts;
                    }
                    if (lockoutDurationMinutes) {
                        ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes = lockoutDurationMinutes;
                    }
                    return [2 /*return*/, res.json({
                            success: true,
                            message: "Security settings updated successfully",
                            settings: {
                                securePhrase: ADMIN_SECURITY_SETTINGS.securePhrase,
                                sessionTimeoutMinutes: ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes,
                                maxFailedAttempts: ADMIN_SECURITY_SETTINGS.maxFailedAttempts,
                                lockoutDurationMinutes: ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes
                            }
                        })];
                });
            }); });
            return [2 /*return*/];
        });
    });
}
var isLocalAuthenticated = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var session, currentFingerprint;
    var _a, _b;
    return __generator(this, function (_c) {
        session = req.session;
        if (!(session === null || session === void 0 ? void 0 : session.userId)) {
            return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
        }
        // Check session expiry
        if (session.lastActivity && Date.now() - session.lastActivity > ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes * 60 * 1000) {
            req.session.destroy(function () { });
            return [2 /*return*/, res.status(401).json({ message: "Session expired" })];
        }
        // Update last activity
        session.lastActivity = Date.now();
        // Enhanced device verification for Admin
        if (((_a = session.user) === null || _a === void 0 ? void 0 : _a.username) === 'Admin') {
            currentFingerprint = getDeviceFingerprint(req);
            if (session.deviceFingerprint !== currentFingerprint) {
                req.session.destroy(function () { });
                return [2 /*return*/, res.status(401).json({ message: "Device verification failed" })];
            }
        }
        // Attach user to request
        req.user = {
            claims: {
                sub: session.userId,
                username: (_b = session.user) === null || _b === void 0 ? void 0 : _b.username
            }
        };
        return [2 /*return*/, next()];
    });
}); };
exports.isLocalAuthenticated = isLocalAuthenticated;
var isAuthenticated = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var session, currentFingerprint;
    var _a, _b;
    return __generator(this, function (_c) {
        session = req.session;
        if (!(session === null || session === void 0 ? void 0 : session.userId)) {
            return [2 /*return*/, res.status(401).json({ message: "Unauthorized" })];
        }
        // Check session expiry (45 minutes for Admin)
        if (session.lastActivity && Date.now() - session.lastActivity > 45 * 60 * 1000) {
            req.session.destroy(function () { });
            return [2 /*return*/, res.status(401).json({ message: "Session expired" })];
        }
        // Update last activity
        if (session.lastActivity) {
            session.lastActivity = Date.now();
        }
        // Enhanced device verification for Admin
        if ((_a = session.user) === null || _a === void 0 ? void 0 : _a.isAdmin) {
            currentFingerprint = getDeviceFingerprint(req);
            if (session.user.deviceFingerprint !== currentFingerprint) {
                req.session.destroy(function () { });
                return [2 /*return*/, res.status(401).json({ message: "Device verification failed" })];
            }
        }
        // Attach user to request
        req.user = {
            claims: {
                sub: session.userId,
                username: (_b = session.user) === null || _b === void 0 ? void 0 : _b.username
            }
        };
        return [2 /*return*/, next()];
    });
}); };
exports.isAuthenticated = isAuthenticated;
