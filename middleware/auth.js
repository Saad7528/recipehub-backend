import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

const getClearCookieOptions = (req) => {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    path: "/",
  };
};

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.clearCookie("token", getClearCookieOptions(req));
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      res.clearCookie("token", getClearCookieOptions(req));
      return res.status(403).json({ error: "Account is blocked" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
}

export function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}
