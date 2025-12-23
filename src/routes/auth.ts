import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User";

const saltRounds = 12;

/**
 * POST /auth/register
 * Registra un nuovo utente
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, username, password, name, surname, role } = req.body;

    // Validazione input
    if (!email || !username || !password || !name || !surname) {
      return res.status(400).json({
        success: false,
        error: "Email, username, password, name e surname sono richiesti",
      });
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Formato email non valido",
      });
    }

    // Validazione password (minimo 6 caratteri)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "La password deve contenere almeno 6 caratteri",
      });
    }

    // Validazione ruolo
    const allowedRoles = ["admin", "issuer", "holder", "verifier"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Ruolo non valido. Ruoli permessi: ${allowedRoles.join(", ")}`,
      });
    }

    // Verifica che email non esista già
    const existingEmail = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: "Email già registrata",
      });
    }

    // Verifica che username non esista già
    const existingUsername = await User.findOne({
      username: username.trim(),
    });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        error: "Username già utilizzato",
      });
    }

    // Hasha la password
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crea il nuovo utente
    const newUser = new User({
      email: email.toLowerCase().trim(),
      username: username.trim(),
      passwordHash,
      name: name.trim(),
      surname: surname.trim(),
      role: role || "verifier", // Default: verifier
      status: "active",
      lastLoginAt: null,
    });

    await newUser.save();

    // Ritorna i dati dell'utente (senza passwordHash)
    return res.status(201).json({
      success: true,
      message: "Utente registrato con successo",
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        surname: newUser.surname,
        role: newUser.role,
        status: newUser.status,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    
    // Gestione errori di duplicato MongoDB
    if (error instanceof Error && error.message.includes("E11000")) {
      return res.status(409).json({
        success: false,
        error: "Email o username già registrati",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Errore durante la registrazione",
    });
  }
}

/**
 * POST /auth/login
 * Autentica un utente con email e password
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validazione input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email e password sono richiesti",
      });
    }

    // Cerca l'utente per email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Credenziali non valide",
      });
    }

    // Verifica lo status e isActive dell'utente
    if (!user.isActive || user.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "Account non attivo",
      });
    }

    // Verifica la password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Credenziali non valide",
      });
    }

    // Aggiorna lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Ritorna i dati dell'utente (senza passwordHash)
    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Errore durante il login:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante il login",
    });
  }
}

