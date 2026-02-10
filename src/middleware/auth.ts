import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Estendi l'interfaccia Request per includere i dati dell'utente autenticato
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  companyId?: number;
}

// Chiave segreta per firmare i JWT (dovrebbe essere in una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Durata del token (24 ore)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Middleware di autenticazione JWT
 * Legge l'header Authorization, verifica il token e estrae userId, role, companyId
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Leggi l'header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: "Token di autenticazione mancante",
      });
      return;
    }

    // Estrai il token (formato: "Bearer <token>")
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        success: false,
        error: "Formato token non valido. Usa: Bearer <token>",
      });
      return;
    }

    const token = parts[1];

    // Verifica e decodifica il token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: "Token scaduto",
        });
        return;
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: "Token non valido",
        });
        return;
      }
      throw error;
    }

    // Estrai userId e role dal token
    if (!decoded.userId || !decoded.role) {
      res.status(401).json({
        success: false,
        error: "Token non contiene informazioni utente valide",
      });
      return;
    }

    // Imposta i dati dell'utente nella richiesta
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // Estrai companyId dal token se presente (opzionale)
    if (decoded.companyId) {
      req.companyId = decoded.companyId;
    } else {
      // Se non presente nel token, prova a leggerlo dall'header X-Company-Id
      const companyIdHeader = req.headers["x-company-id"];
      if (companyIdHeader) {
        req.companyId = parseInt(companyIdHeader as string, 10);
      }
    }

    next();
  } catch (error) {
    console.error("Errore nel middleware di autenticazione:", error);
    res.status(500).json({
      success: false,
      error: "Errore durante l'autenticazione",
    });
  }
}

/**
 * Funzione helper per generare un JWT token
 */
export function generateToken(
  userId: string,
  role: string,
  companyId?: number
): string {
  const payload: any = {
    userId,
    role,
  };

  // Aggiungi companyId solo se presente
  if (companyId !== undefined) {
    payload.companyId = companyId;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Esporta anche JWT_SECRET per uso in altri moduli se necessario
export { JWT_SECRET, JWT_EXPIRES_IN };
