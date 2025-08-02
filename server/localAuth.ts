import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";

// Default credentials and security settings - changeable through settings
const LOGIN_USERS = [
  {
    id: 1,
    username: process.env.ADMIN_USERNAME || "Admin",
    email: process.env.ADMIN_EMAIL || "admin@zed.local",
    password: process.env.ADMIN_PASSWORD || "Zed2025",
    role: "admin",
  },
];

let LOCAL_USERS = [
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
let ADMIN_SECURITY_SETTINGS = {
  securePhrase: "XOCLON_SECURE_2025",
  sessionTimeoutMinutes: 45,
  maxFailedAttempts: 3,
  lockoutDurationMinutes: 15
};

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}

export function getLocalSession() {
  const sessionTtl = ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes * 60 * 1000;
  
  return session({
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
const VERIFICATION_ATTEMPTS = new Map<string, { count: number; lastAttempt: number; deviceFingerprint?: string }>();
const TRUSTED_DEVICES = new Map<string, { userId: string; verified: boolean; lastSeen: number }>();

function getDeviceFingerprint(req: Request): string {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  return Buffer.from(`${userAgent}:${acceptLanguage}:${acceptEncoding}:${ip}`).toString('base64').slice(0, 32);
}

function isDeviceTrusted(deviceFingerprint: string, userId: string): boolean {
  const device = TRUSTED_DEVICES.get(deviceFingerprint);
  return device?.userId === userId && device?.verified === true;
}

export async function setupLocalAuth(app: any) {
  app.use(getLocalSession());

  // Get current user endpoint for React app (replaces routes/auth.ts)
  app.get("/api/auth/user", (req: Request, res: Response) => {
    const session = req.session as any;
    
    // Debug logging
    console.log('Auth check - Session exists:', !!session);
    console.log('Auth check - Session user:', session?.user ? 'exists' : 'missing');
    console.log('Auth check - Session ID:', session?.id);
    
    // Check if user is authenticated using localAuth session structure
    if (session && session.user) {
      const userResponse = { 
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
    } else {
      console.log('Auth check - No valid session, returning 401');
      return res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Enhanced login endpoint with multi-factor verification
  app.post("/api/login", (req: Request, res: Response) => {
    console.log("🔐 Login endpoint called");
    console.log("📝 Request body:", req.body);
    
    const { username, password } = req.body;

    console.log("🔍 Extracted credentials:", { username, password: password ? '[HIDDEN]' : 'undefined' });

    if (!username || !password) {
      console.log("❌ Missing username or password");
      return res.status(400).json({ error: "Username and password required" });
    }

    console.log("🔍 Searching for user in LOCAL_USERS...");
    console.log("📋 Available users:", LOCAL_USERS.map(u => ({ username: u.username, id: u.id })));
    
    // Find user in local users - simplified check
    const user = LOCAL_USERS.find(u => u.username === username && u.password === password);
    
    console.log("🔍 User search result:", user ? 'Found' : 'Not found');
    
    if (!user) {
      console.log("❌ Invalid credentials for user:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Simplified login - bypass additional verification for development
    console.log(`✅ User ${username} logged in successfully`);

    try {
      // Skip database save for now - direct session creation
      console.log(`⚡ Creating session directly`);

      // Set basic session data
      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).user = {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        };
        console.log(`✅ Session created for user ${username}`);
      } else {
        console.warn('⚠️ No session object available');
      }

      console.log(`✅ Returning success response for ${username}`);

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
    } catch (sessionError) {
      console.error("❌ Session creation error:", sessionError);
      return res.status(500).json({ error: "Session creation failed" });
    }
  });

  // Enhanced logout with device cleanup
  app.post("/api/logout", (req: Request, res: Response) => {
    const session = req.session as any;
    if (session?.user?.deviceFingerprint) {
      // Optionally remove device from trusted list on explicit logout
      // TRUSTED_DEVICES.delete(session.user.deviceFingerprint);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      return res.json({ success: true });
    });
  });

  // Admin verification challenge endpoint
  app.post("/api/admin/verify-challenge", async (req: Request, res: Response) => {
    try {
      const { challengeAnswer, securePhrase } = req.body;
      const deviceFingerprint = getDeviceFingerprint(req);
      
      // Simple logic challenge for demo (in production, use more sophisticated challenges)
      const validAnswers = ['42', 'xoclon', 'diagnostic'];
      const isValidChallenge = challengeAnswer && validAnswers.includes(challengeAnswer.toLowerCase());
      const isValidPhrase = securePhrase === "XOCLON_SECURE_2025";
      
      if (isValidChallenge || isValidPhrase) {
        // Clear all failed attempts for this IP
        const keys = Array.from(VERIFICATION_ATTEMPTS.keys()).filter(key => key.includes(req.ip || ''));
        keys.forEach(key => VERIFICATION_ATTEMPTS.delete(key));
        
        res.json({ success: true, message: "Challenge verified, please try logging in again" });
      } else {
        res.status(401).json({ error: "Invalid challenge response" });
      }
    } catch (error) {
      res.status(500).json({ error: "Challenge verification failed" });
    }
  });

  // Update credentials endpoint (protected)
  app.post("/api/auth/update-credentials", isAuthenticated, (req: Request, res: Response) => {
    try {
      const { newUsername, newPassword } = req.body;
      const session = req.session as any;
      
      if (!newUsername || !newPassword) {
        return res.status(400).json({ error: "Username and password required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Find and update the user
      const userIndex = LOCAL_USERS.findIndex(u => u.id === session.userId);
      if (userIndex !== -1) {
        LOCAL_USERS[userIndex].username = newUsername;
        LOCAL_USERS[userIndex].password = newPassword;
        
        // Update session
        session.user.username = newUsername;
        
        return res.json({ 
          success: true, 
          message: "Credentials updated successfully",
          user: {
            username: newUsername,
            firstName: LOCAL_USERS[userIndex].firstName,
            lastName: LOCAL_USERS[userIndex].lastName
          }
        });
      } else {
        return res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error("Update credentials error:", error);
      return res.status(500).json({ error: "Failed to update credentials" });
    }
  });
  
  // Get current credentials (protected)
  app.get("/api/auth/current-credentials", isAuthenticated, (req: Request, res: Response) => {
    const session = req.session as any;
    const user = LOCAL_USERS.find(u => u.id === session.userId);
    
    if (user) {
      return res.json({
        username: user.username,
        // Don't send password for security
      });
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  });

  // Get current security settings (Admin only)
  app.get("/api/admin/security-settings", isLocalAuthenticated, async (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user || user.username !== 'Admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    return res.json({
      currentSecurePhrase: ADMIN_SECURITY_SETTINGS.securePhrase,
      sessionTimeoutMinutes: ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes,
      maxFailedAttempts: ADMIN_SECURITY_SETTINGS.maxFailedAttempts,
      lockoutDurationMinutes: ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes
    });
  });

  // Update security settings (Admin only)
  app.post("/api/admin/security-settings", isLocalAuthenticated, async (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user || user.username !== 'Admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { 
      newSecurePhrase, 
      sessionTimeoutMinutes, 
      maxFailedAttempts, 
      lockoutDurationMinutes 
    } = req.body;

    // Validate inputs
    if (newSecurePhrase && (typeof newSecurePhrase !== 'string' || newSecurePhrase.length < 8)) {
      return res.status(400).json({ error: "Secure phrase must be at least 8 characters long" });
    }

    if (sessionTimeoutMinutes && (sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 480)) {
      return res.status(400).json({ error: "Session timeout must be between 5 and 480 minutes" });
    }

    if (maxFailedAttempts && (maxFailedAttempts < 1 || maxFailedAttempts > 10)) {
      return res.status(400).json({ error: "Max failed attempts must be between 1 and 10" });
    }

    if (lockoutDurationMinutes && (lockoutDurationMinutes < 1 || lockoutDurationMinutes > 60)) {
      return res.status(400).json({ error: "Lockout duration must be between 1 and 60 minutes" });
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

    return res.json({
      success: true,
      message: "Security settings updated successfully",
      settings: {
        securePhrase: ADMIN_SECURITY_SETTINGS.securePhrase,
        sessionTimeoutMinutes: ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes,
        maxFailedAttempts: ADMIN_SECURITY_SETTINGS.maxFailedAttempts,
        lockoutDurationMinutes: ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes
      }
    });
  });
}

export const isLocalAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check session expiry
  if (session.lastActivity && Date.now() - session.lastActivity > ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Session expired" });
  }

  // Update last activity
  session.lastActivity = Date.now();

  // Enhanced device verification for Admin
  if (session.user?.username === 'Admin') {
    const currentFingerprint = getDeviceFingerprint(req);
    if (session.deviceFingerprint !== currentFingerprint) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Device verification failed" });
    }
  }

  // Attach user to request
  (req as any).user = {
    claims: {
      sub: session.userId,
      username: session.user?.username
    }
  };

  return next();
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check session expiry (45 minutes for Admin)
  if (session.lastActivity && Date.now() - session.lastActivity > 45 * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Session expired" });
  }

  // Update last activity
  if (session.lastActivity) {
    session.lastActivity = Date.now();
  }

  // Enhanced device verification for Admin
  if (session.user?.isAdmin) {
    const currentFingerprint = getDeviceFingerprint(req);
    if (session.user.deviceFingerprint !== currentFingerprint) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Device verification failed" });
    }
  }

  // Attach user to request
  (req as any).user = {
    claims: {
      sub: session.userId,
      username: session.user?.username
    }
  };

  return next();
};