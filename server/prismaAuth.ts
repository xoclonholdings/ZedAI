import { Request, Response, NextFunction } from "express";
import { prisma, testDatabaseConnection } from './prisma';
import bcrypt from 'bcrypt';

// Types for authentication
interface LoginRequest {
  username: string;
  password: string;
}

interface AuthenticatedUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

// Authentication middleware using Prisma
export const prismaAuth = async (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as any;
  
  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user to request
    (req as any).user = {
      claims: {
        sub: user.id,
        email: user.email
      }
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Authentication error" });
  }
};

// Login endpoint using Prisma
export const prismaLogin = async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user by email (since we don't have username in schema)
    const user = await prisma.user.findUnique({
      where: { email: username }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Since we don't have passwords in the existing schema, we'll use a simple check
    // For Admin user: admin@zed.local with password "Zed2025"
    // For Demo user: demo@zed.local with password "demo123"
    const validPassword = (username === 'admin@zed.local' && password === 'Zed2025') ||
                         (username === 'demo@zed.local' && password === 'demo123');

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create session
    if (req.session) {
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    res.json({
      success: true,
      user: authenticatedUser
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

// Get current user endpoint
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    
    if (!session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
};

// Setup function to initialize database connection and create default users
export async function setupPrismaAuth(app: any) {
  // Test database connection
  const connected = await testDatabaseConnection();
  if (!connected) {
    console.error("[PRISMA] Failed to connect to database");
    return false;
  }

  // Create default admin user if it doesn't exist
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@zed.local' }
    });

    if (!adminUser) {
      await prisma.user.create({
        data: {
          id: 'admin_user_001',
          email: 'admin@zed.local',
          firstName: 'Admin',
          lastName: 'User',
        }
      });
      console.log('[PRISMA] Default admin user created');
    }

    // Create demo user if it doesn't exist
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@zed.local' }
    });

    if (!demoUser) {
      await prisma.user.create({
        data: {
          id: 'demo_user_001',
          email: 'demo@zed.local',
          firstName: 'Demo',
          lastName: 'User',
        }
      });
      console.log('[PRISMA] Demo user created');
    }

  } catch (error) {
    console.error('[PRISMA] Error creating default users:', error);
  }

  // Setup auth routes
  app.post("/api/prisma/login", prismaLogin);
  app.get("/api/prisma/user", prismaAuth, getCurrentUser);

  return true;
}

export { prisma };