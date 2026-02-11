import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// JWT Secret - non usare .env, usa una chiave segreta fissa
const JWT_SECRET: string = "certifi-jwt-secret-key-2026-production-change-this";
const JWT_EXPIRES_IN: string = "24h";

export interface AuthRequest extends Request {
  userId?: string; // MongoDB _id come stringa
  userRole?: "admin" | "issuer" | "verifier" | "holder" | "auditor";
}

export interface JWTPayload {
  userId: string; // MongoDB _id come stringa
  role: "admin" | "issuer" | "verifier" | "holder" | "auditor";
  email: string;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: JWTPayload): string {
  const tokenPayload = {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify JWT token and extract user information
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Authentication middleware - verifies JWT token from Authorization header
 * Requires: Authorization: Bearer <token>
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    const authReq = req as AuthRequest;
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: "Authorization header is required",
      });
      return;
    }

    // Check if Bearer token format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        success: false,
        error: "Invalid authorization format. Use: Bearer <token>",
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
      return;
    }

    // Attach user info to request
    authReq.userId = payload.userId;
    authReq.userRole = payload.role;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
}
