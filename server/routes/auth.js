"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var router = (0, express_1.Router)();
// Get current user endpoint for React app
router.get("/api/auth/user", function (req, res) {
    // Skip authentication for development - return a mock user
    return res.json({
        user: {
            id: "dev-user",
            username: "Developer",
            email: "dev@zed.local",
            firstName: "Dev",
            lastName: "User",
            isAdmin: true
        },
        verified: true
    });
});
router.post("/api/login", function (req, res) {
    var _a = req.body, username = _a.username, password = _a.password;
    // Replace with your real user validation
    if (username === "Admin" && password === "Zed2025") {
        req.session.user = { username: username };
        req.session.verified = false; // Ensure verified is reset on login
        return res.json({ success: true, message: "Login successful" });
    }
    return res.status(401).json({ success: false, reason: "Invalid credentials" });
});
router.post("/api/verify", function (req, res) {
    var _a = req.body, username = _a.username, method = _a.method, phrase = _a.phrase;
    if (req.session.user &&
        username === "Admin" &&
        method === "secure_phrase" &&
        phrase === "XOCLON_SECURE_2025") {
        req.session.verified = true;
        return res.json({ success: true, message: "Secondary authentication passed" });
    }
    return res.status(401).json({ success: false, reason: "Secondary authentication failed" });
});
exports.default = router;
