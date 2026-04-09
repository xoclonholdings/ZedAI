import { Request, Response, NextFunction } from "express";
import session from "express-session";

// Default credentials and security settings - changeable through settings
let LOCAL_USERS = [
  {
    id: "user_001",
    username: "Admin",
    password: "Zed2025!",
    email: "admin@zed-ai.online",
    firstName: "ZED",
    lastName: "Admin",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
  }
];

// Admin security settings - updatable by admin
let ADMIN_SECURITY_SETTINGS = {
  securePhrase: "XOCLON-SECURE-2025",
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

  // Enhanced login endpoint with multi-factor verification
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password, securePhrase, requiresVerification } = req.body;
      const deviceFingerprint = getDeviceFingerprint(req);

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      // Track verification attempts
      const attemptKey = `${username}:${req.ip}`;
      const attempts = VERIFICATION_ATTEMPTS.get(attemptKey) || { count: 0, lastAttempt: 0 };
      
      // Check for repeated failed attempts
      if (attempts.count >= ADMIN_SECURITY_SETTINGS.maxFailedAttempts && Date.now() - attempts.lastAttempt < ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes * 60 * 1000) {
        return res.status(429).json({ 
          error: "Too many failed attempts", 
          requiresChallenge: true,
          message: `Please wait ${ADMIN_SECURITY_SETTINGS.lockoutDurationMinutes} minutes or provide your secure phrase to bypass`
        });
      }

      // Find user in local users
      const user = LOCAL_USERS.find(u => u.username === username && u.password === password);
      
      if (!user) {
        // Increment failed attempts
        VERIFICATION_ATTEMPTS.set(attemptKey, {
          count: attempts.count + 1,
          lastAttempt: Date.now(),
          deviceFingerprint
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // For Admin user, check additional verification requirements
      if (user.username === 'Admin') {
        const deviceTrusted = isDeviceTrusted(deviceFingerprint, user.id);
        
        // Check if secondary verification is needed
        if (!deviceTrusted && !securePhrase && !requiresVerification) {
          return res.status(200).json({
            requiresSecondaryAuth: true,
            methods: ['secure_phrase', 'device_verification'],
            message: "Admin login from new device requires additional verification"
          });
        }
        
        // Verify secure phrase if provided
        if (securePhrase && securePhrase !== ADMIN_SECURITY_SETTINGS.securePhrase) {
          VERIFICATION_ATTEMPTS.set(attemptKey, {
            count: attempts.count + 1,
            lastAttempt: Date.now(),
            deviceFingerprint
          });
          return res.status(401).json({ error: "Invalid secure phrase" });
        }
        
        // If verification passed, mark device as trusted
        if (securePhrase === ADMIN_SECURITY_SETTINGS.securePhrase || deviceTrusted) {
          TRUSTED_DEVICES.set(deviceFingerprint, {
            userId: user.id,
            verified: true,
            lastSeen: Date.now()
          });
        }
      }

      // Clear failed attempts on successful login
      VERIFICATION_ATTEMPTS.delete(attemptKey);

      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      };

      res.json({
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
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
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
      res.json({ success: true });
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
        
        res.json({ 
          success: true, 
          message: "Credentials updated successfully",
          user: {
            username: newUsername,
            firstName: LOCAL_USERS[userIndex].firstName,
            lastName: LOCAL_USERS[userIndex].lastName
          }
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error("Update credentials error:", error);
      res.status(500).json({ error: "Failed to update credentials" });
    }
  });
  
  // Get current credentials (protected)
  app.get("/api/auth/current-credentials", isAuthenticated, (req: Request, res: Response) => {
    const session = req.session as any;
    const user = LOCAL_USERS.find(u => u.id === session.userId);
    
    if (user) {
      res.json({
        username: user.username,
        // Don't send password for security
      });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // Get current security settings (Admin only)
  app.get("/api/admin/security-settings", isLocalAuthenticated, async (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user || user.username !== 'Admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    res.json({
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

    res.json({
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

  (req as any).user = {
    claims: {
      sub: session.userId,
      username: session.user?.username
    }
  };

  next();
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as any;

  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (session.lastActivity && Date.now() - session.lastActivity > ADMIN_SECURITY_SETTINGS.sessionTimeoutMinutes * 60 * 1000) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Session expired" });
  }

  session.lastActivity = Date.now();

  (req as any).user = {
    claims: {
      sub: session.userId,
      username: session.user?.username
    }
  };

  next();
};