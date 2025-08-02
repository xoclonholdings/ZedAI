"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authMiddleware;
function authMiddleware(req, res, next) {
    // Check for session and verification
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, reason: "Session missing or expired" });
    }
    if (!req.session.verified) {
        return res.status(401).json({ success: false, reason: "Secondary authentication required" });
    }
    next();
}
