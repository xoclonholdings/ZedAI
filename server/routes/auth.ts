import { Router, Request, Response } from "express";

const router = Router();

// Get current user endpoint for React app
router.get("/api/auth/user", (req: Request, res: Response) => {
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

router.post("/api/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  // Replace with your real user validation
  if (username === "Admin" && password === "Zed2025") {
    req.session.user = { username };
    req.session.verified = false; // Ensure verified is reset on login
    return res.json({ success: true, message: "Login successful" });
  }
  return res.status(401).json({ success: false, reason: "Invalid credentials" });
});

router.post("/api/verify", (req: Request, res: Response) => {
  const { username, method, phrase } = req.body;
  if (
    req.session.user &&
    username === "Admin" &&
    method === "secure_phrase" &&
    phrase === "XOCLON_SECURE_2025"
  ) {
    req.session.verified = true;
    return res.json({ success: true, message: "Secondary authentication passed" });
  }
  return res.status(401).json({ success: false, reason: "Secondary authentication failed" });
});

export default router;