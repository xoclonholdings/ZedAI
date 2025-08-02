import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import cors from "cors";

// Extend session type to include custom properties
declare module "express-session" {
  interface SessionData {
    isAuthenticated?: boolean;
    securePhraseRequired?: boolean;
    zedSessionToken?: string;
  }
}

const app = express();

// CORS FIRST!
app.use(
  cors({
    origin: "http://localhost:5000", // or "*" for local testing
    credentials: true,
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Set to true in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// In-memory trusted devices store: { username: [ { deviceId, verifiedAt, expiresAt } ] }
type TrustedDevice = {
  deviceId: string;
  verifiedAt: Date;
  expiresAt: Date;
};
const trustedDevices: Record<string, TrustedDevice[]> = {};

// In-memory session token store
const sessionTokens = new Set<string>();

// Helper to get device ID (IP + user-agent)
function getDeviceId(req: express.Request): string {
  const ip = req.ip || req.connection.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";
  return `${ip}_${ua}`;
}

// Helper: isTrustedDevice
function isTrustedDevice(username: string, deviceId: string): boolean {
  const now = new Date();
  const devices = trustedDevices[username] || [];
  const found = devices.find(
    (d) => d.deviceId === deviceId && d.expiresAt >= now
  );
  return !!found;
}

// Helper: mark device as trusted (add or update)
function markDeviceTrusted(username: string, deviceId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
  let devices = trustedDevices[username] || [];
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx].verifiedAt = now;
    devices[idx].expiresAt = expiresAt;
  } else {
    devices.push({ deviceId, verifiedAt: now, expiresAt });
  }
  trustedDevices[username] = devices;
}

// Helper: validate session token
function isValidSessionToken(token: string) {
  return sessionTokens.has(token);
}

// Login route with secure token cookie
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "Admin" && password === "Zed2025") {
    const deviceId = getDeviceId(req);
    const userDevices = trustedDevices[username] || [];

    // Generate a secure token (random string)
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("zed_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    if (userDevices.find((d) => d.deviceId === deviceId)) {
      req.session.isAuthenticated = true;
      req.session.securePhraseRequired = false;
      return res.json({
        success: true,
        message: "Login successful. Trusted device.",
        requiresSecondaryAuth: false,
      });
    } else {
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
app.post("/api/verify", (req, res) => {
  const { username, method, phrase } = req.body;
  if (
    req.session.isAuthenticated &&
    req.session.securePhraseRequired &&
    username === "Admin" &&
    method === "secure_phrase" &&
    phrase === "XOCLON_SECURE_2025"
  ) {
    // Add/update device to trusted devices with expiration
    const deviceId = getDeviceId(req);
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
app.post("/api/conversations/:id/messages", (req, res) => {
  const token = req.cookies.zed_session;
  if (
    token &&
    isValidSessionToken(token) &&
    req.session.isAuthenticated &&
    !req.session.securePhraseRequired
  ) {
    // ...handle message logic...
    return res.json({ message: "Message received." });
  }
  res.status(401).json({ message: "Unauthorized" });
});

// Example protected GET route
app.get("/api/protected", (req, res) => {
  const token = req.cookies.zed_session;
  if (
    token &&
    isValidSessionToken(token) &&
    req.session.isAuthenticated &&
    !req.session.securePhraseRequired
  ) {
    return res.json({ message: "Access granted to protected resource." });
  }
  res.status(403).json({ error: "Access denied." });
});

export default app;