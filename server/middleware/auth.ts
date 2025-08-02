import { Request, Response, NextFunction } from "express";
import session from "express-session";

// Extend the session type to include 'user' and 'verified'
declare module "express-session" {
  interface SessionData {
    user?: any;
    verified?: boolean;
  }
}

export default function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check for session and verification
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, reason: "Session missing or expired" });
  }
  if (!req.session.verified) {
    return res.status(401).json({ success: false, reason: "Secondary authentication required" });
  }
  next();
}