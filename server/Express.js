import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

// 1. CORS FIRST!
app.use(cors({
  origin: "http://localhost:5000", // or your frontend origin
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
}));

// 2. Parse JSON and cookies before routes
app.use(express.json());
app.use(cookieParser());

// 3. Example login route that sets a cookie
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  // Replace with your real user validation
  if (username === "Admin" && password === "Zed2025") {
    // Set cookie for session management
    res.cookie("zed_session", "secure_token_value", {
      httpOnly: true,
      secure: false, // true in production
      sameSite: "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    return res.json({ success: true, message: "Login successful" });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// 4. Example protected route
app.post("/api/conversations/:id/messages", (req, res) => {
  const token = req.cookies.zed_session;
  if (token === "secure_token_value") {
    return res.json({ message: "Message received." });
  }
  res.status(401).json({ message: "Unauthorized" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});