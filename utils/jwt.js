import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-recipehub-key-change-in-prod";

export async function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
