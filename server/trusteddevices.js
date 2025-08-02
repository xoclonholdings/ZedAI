"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var express_session_1 = require("express-session");
var cookie_parser_1 = require("cookie-parser");
var crypto_1 = require("crypto");
var cors_1 = require("cors");
var app = (0, express_1.default)();
// CORS FIRST!
app.use((0, cors_1.default)({
    origin: "http://localhost:5000", // or "*" for local testing
    credentials: true,
    exposedHeaders: ["Set-Cookie"],
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, express_session_1.default)({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // Set to true in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
}));
var trustedDevices = {};
// In-memory session token store
var sessionTokens = new Set();
// Helper to get device ID (IP + user-agent)
function getDeviceId(req) {
    var ip = req.ip || req.connection.remoteAddress || "";
    var ua = req.headers["user-agent"] || "";
    return "".concat(ip, "_").concat(ua);
}
// Helper: isTrustedDevice
function isTrustedDevice(username, deviceId) {
    var now = new Date();
    var devices = trustedDevices[username] || [];
    var found = devices.find(function (d) { return d.deviceId === deviceId && d.expiresAt >= now; });
    return !!found;
}
// Helper: mark device as trusted (add or update)
function markDeviceTrusted(username, deviceId) {
    var now = new Date();
    var expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
    var devices = trustedDevices[username] || [];
    var idx = devices.findIndex(function (d) { return d.deviceId === deviceId; });
    if (idx >= 0) {
        devices[idx].verifiedAt = now;
        devices[idx].expiresAt = expiresAt;
    }
    else {
        devices.push({ deviceId: deviceId, verifiedAt: now, expiresAt: expiresAt });
    }
    trustedDevices[username] = devices;
}
// Helper: validate session token
function isValidSessionToken(token) {
    return sessionTokens.has(token);
}
// Login route with secure token cookie
app.post("/api/login", function (req, res) {
    var _a = req.body, username = _a.username, password = _a.password;
    if (username === "Admin" && password === "Zed2025") {
        var deviceId_1 = getDeviceId(req);
        var userDevices = trustedDevices[username] || [];
        // Generate a secure token (random string)
        var token = crypto_1.default.randomBytes(32).toString("hex");
        res.cookie("zed_session", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        if (userDevices.find(function (d) { return d.deviceId === deviceId_1; })) {
            req.session.isAuthenticated = true;
            req.session.securePhraseRequired = false;
            return res.json({
                success: true,
                message: "Login successful. Trusted device.",
                requiresSecondaryAuth: false,
            });
        }
        else {
            req.session.isAuthenticated = true;
            req.session.securePhraseRequired = true;
            return res.json({
                success: true,
                message: "Login successful. New device, secure phrase required.",
                requiresSecondaryAuth: true,
            });
        }
    }
    res.status(401).json({ error: "Invalid credentials" });
});
// Secure phrase verification route
app.post("/api/verify", function (req, res) {
    var _a = req.body, username = _a.username, method = _a.method, phrase = _a.phrase;
    if (req.session.isAuthenticated &&
        req.session.securePhraseRequired &&
        username === "Admin" &&
        method === "secure_phrase" &&
        phrase === "XOCLON_SECURE_2025") {
        // Add/update device to trusted devices with expiration
        var deviceId = getDeviceId(req);
        markDeviceTrusted(username, deviceId);
        req.session.securePhraseRequired = false;
        return res.json({
            success: true,
            message: "Secondary authentication passed. Device trusted.",
        });
    }
    res.status(401).json({ error: "Secondary authentication failed" });
});
// Example protected route (use this logic for your /api/conversations/:id/messages route)
app.post("/api/conversations/:id/messages", function (req, res) {
    var token = req.cookies.zed_session;
    if (token &&
        isValidSessionToken(token) &&
        req.session.isAuthenticated &&
        !req.session.securePhraseRequired) {
        // ...handle message logic...
        return res.json({ message: "Message received." });
    }
    res.status(401).json({ message: "Unauthorized" });
});
// Example protected GET route
app.get("/api/protected", function (req, res) {
    var token = req.cookies.zed_session;
    if (token &&
        isValidSessionToken(token) &&
        req.session.isAuthenticated &&
        !req.session.securePhraseRequired) {
        return res.json({ message: "Access granted to protected resource." });
    }
    res.status(403).json({ error: "Access denied." });
});
exports.default = app;
