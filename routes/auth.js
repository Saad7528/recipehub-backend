import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken, verifyToken } from "../utils/jwt.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ user: null });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return res.json({ user: null });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.clearCookie("token", { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
      return res.json({ user: null });
    }

    if (user.isBlocked) {
      res.clearCookie("token", { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
      return res.status(403).json({ error: "Account is blocked" });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isPremium: user.isPremium,
      },
    });
  } catch (error) {
    console.error("Auth Me Error:", error);
    return res.json({ user: null });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, image } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    if (!hasUppercase || !hasLowercase) {
      return res.status(400).json({ error: "Password must contain at least one uppercase and one lowercase letter" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      image: image || "",
      role: "user",
      isBlocked: false,
      isPremium: false,
    });

    return res.status(201).json({ message: "Registration successful", userId: newUser._id });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account is blocked. Please contact admin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Let cookies work on localhost cross-port
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isPremium: user.isPremium,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { name, email, image } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and Name are required for Google Login" });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.isBlocked) {
        return res.status(403).json({ error: "Your account is blocked. Please contact admin." });
      }
      if (!user.image && image) {
        user.image = image;
        await user.save();
      }
    } else {
      const randomPassword = Math.random().toString(36).slice(-10) + "A1a";
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        image: image || "",
        role: "user",
        isBlocked: false,
        isPremium: false,
      });
    }

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      message: "Google Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isPremium: user.isPremium,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  return res.json({ message: "Logged out successfully" });
});

export default router;
