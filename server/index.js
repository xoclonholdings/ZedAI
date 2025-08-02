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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var express_1 = require("express");
var cookie_parser_1 = require("cookie-parser");
var express_session_1 = require("express-session");
var cors_1 = require("cors");
var routes_1 = require("./routes");
var vite_1 = require("./vite");
var db_1 = require("./db");
var migrations_1 = require("./migrations");
var auth_1 = require("./middleware/auth");
var app = (0, express_1.default)();
// CORS FIRST!
app.use((0, cors_1.default)({
    origin: "http://localhost:5001",
    credentials: true,
    exposedHeaders: ["Set-Cookie"],
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, express_session_1.default)({
    secret: "your_secret",
    resave: false,
    saveUninitialized: false,
    name: "zed_session", // Explicitly set session name
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // true in production
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
}));
// Serve uploaded files statically
app.use('/uploads', express_1.default.static('uploads'));
// Request timing + response capture
app.use(function (req, res, next) {
    var start = Date.now();
    var path = req.path;
    var capturedJsonResponse = undefined;
    var originalResJson = res.json.bind(res);
    res.json = function (bodyJson) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(void 0, __spreadArray([bodyJson], args, false));
    };
    res.on('finish', function () {
        var duration = Date.now() - start;
        (0, vite_1.log)("[".concat(req.method, "] ").concat(path, " - ").concat(res.statusCode, " (").concat(duration, "ms)"));
        if (capturedJsonResponse) {
            (0, vite_1.log)("Response: ".concat(JSON.stringify(capturedJsonResponse)));
        }
    });
    next();
});
// Error handler middleware
app.use(function (err, req, res, next) {
    (0, vite_1.log)("Global error handler:", err);
    res.status(500).json({ error: "Internal server error" });
});
// Use authentication routes and middleware
// app.use(authRoutes); // Disabled - using localAuth instead
// Example protected route
app.post("/api/conversations/:id/messages", auth_1.default, function (req, res) {
    // If authMiddleware passes, user is authenticated
    res.json({ message: "Message received." });
});
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var dbError_1, httpServer, PORT_1, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, (0, db_1.checkDatabaseConnection)()];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, migrations_1.runMigrations)()];
            case 3:
                _a.sent();
                (0, vite_1.log)("✅ Database connected and migrations completed");
                return [3 /*break*/, 5];
            case 4:
                dbError_1 = _a.sent();
                (0, vite_1.log)("⚠️ Database connection failed - running in offline mode:", String(dbError_1));
                return [3 /*break*/, 5];
            case 5: return [4 /*yield*/, (0, routes_1.registerRoutes)(app)];
            case 6:
                httpServer = _a.sent();
                if (!(process.env.NODE_ENV === "development")) return [3 /*break*/, 8];
                return [4 /*yield*/, (0, vite_1.setupVite)(app)];
            case 7:
                _a.sent();
                return [3 /*break*/, 9];
            case 8:
                (0, vite_1.serveStatic)(app);
                _a.label = 9;
            case 9:
                PORT_1 = process.env.PORT ? parseInt(process.env.PORT) : 5001;
                httpServer.listen(PORT_1, function () {
                    (0, vite_1.log)("\uD83D\uDE80 Server listening on http://localhost:".concat(PORT_1));
                });
                return [3 /*break*/, 11];
            case 10:
                error_1 = _a.sent();
                (0, vite_1.log)("❌ Failed to start server: " + String(error_1));
                process.exit(1);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); })();
