import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User";

const saltRounds = 12;

/**
 * POST /users
 * Crea un nuovo utente
 */
export async function createUser(req: Request, res: Response) {
  try {
    const { email, username, password, name, surname, role, status, isActive } =
      req.body;

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

    // Validazione status se fornito
    if (status) {
      const allowedStatuses = ["active", "inactive", "suspended"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status non valido. Status permessi: ${allowedStatuses.join(
            ", "
          )}`,
        });
      }
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
      status: status || "active", // Default: active
      isActive: isActive !== undefined ? Boolean(isActive) : true, // Default: true
      lastLoginAt: null,
    });

    await newUser.save();

    // Ritorna i dati dell'utente (senza passwordHash)
    return res.status(201).json({
      success: true,
      message: "Utente creato con successo",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        surname: newUser.surname,
        role: newUser.role,
        status: newUser.status,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Errore durante la creazione utente:", error);

    // Gestione errori di duplicato MongoDB
    if (error instanceof Error && error.message.includes("E11000")) {
      return res.status(409).json({
        success: false,
        error: "Email o username già registrati",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Errore durante la creazione utente",
    });
  }
}

/**
 * GET /users/:id
 * Ottiene un utente per ID
 */
export async function getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        success: false,
        error: "ID utente non valido (deve essere un numero positivo)",
      });
    }

    const user = await User.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utente non trovato",
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Errore durante il recupero utente:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante il recupero utente",
    });
  }
}

/**
 * GET /users
 * Ottiene la lista di tutti gli utenti
 */
export async function getUsers(req: Request, res: Response) {
  try {
    const users = await User.find().select("-passwordHash");

    return res.json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      })),
      count: users.length,
    });
  } catch (error) {
    console.error("Errore durante il recupero utenti:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante il recupero utenti",
    });
  }
}

/**
 * PUT /users/:id
 * Aggiorna completamente un utente
 */
export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    const { email, username, password, name, surname, role, status, isActive } =
      req.body;

    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        success: false,
        error: "ID utente non valido (deve essere un numero positivo)",
      });
    }

    const user = await User.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utente non trovato",
      });
    }

    // Validazione email se fornita
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Formato email non valido",
        });
      }

      // Verifica che email non sia già usata da un altro utente
      const existingEmail = await User.findOne({
        email: email.toLowerCase().trim(),
        id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: "Email già registrata",
        });
      }
      user.email = email.toLowerCase().trim();
    }

    // Verifica che username non sia già usato da un altro utente
    if (username) {
      const existingUsername = await User.findOne({
        username: username.trim(),
        id: { $ne: userId },
      });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: "Username già utilizzato",
        });
      }
      user.username = username.trim();
    }

    // Aggiorna password se fornita
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: "La password deve contenere almeno 6 caratteri",
        });
      }
      user.passwordHash = await bcrypt.hash(password, saltRounds);
    }

    // Aggiorna altri campi
    if (name !== undefined) user.name = name.trim();
    if (surname !== undefined) user.surname = surname.trim();

    // Validazione ruolo
    if (role) {
      const allowedRoles = ["admin", "issuer", "holder", "verifier"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Ruolo non valido. Ruoli permessi: ${allowedRoles.join(", ")}`,
        });
      }
      user.role = role;
    }

    // Validazione status
    if (status) {
      const allowedStatuses = ["active", "inactive", "suspended"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status non valido. Status permessi: ${allowedStatuses.join(
            ", "
          )}`,
        });
      }
      user.status = status;
    }

    // Aggiorna isActive
    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    await user.save();

    return res.json({
      success: true,
      message: "Utente aggiornato con successo",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Errore durante l'aggiornamento utente:", error);

    // Gestione errori di duplicato MongoDB
    if (error instanceof Error && error.message.includes("E11000")) {
      return res.status(409).json({
        success: false,
        error: "Email o username già registrati",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Errore durante l'aggiornamento utente",
    });
  }
}

/**
 * PATCH /users/:id
 * Aggiorna parzialmente un utente
 */
export async function patchUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    const updateData = req.body;

    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        success: false,
        error: "ID utente non valido (deve essere un numero positivo)",
      });
    }

    const user = await User.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utente non trovato",
      });
    }

    // Validazione email se fornita
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          error: "Formato email non valido",
        });
      }

      const existingEmail = await User.findOne({
        email: updateData.email.toLowerCase().trim(),
        id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: "Email già registrata",
        });
      }
      user.email = updateData.email.toLowerCase().trim();
    }

    // Verifica username se fornito
    if (updateData.username) {
      const existingUsername = await User.findOne({
        username: updateData.username.trim(),
        id: { $ne: userId },
      });
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: "Username già utilizzato",
        });
      }
      user.username = updateData.username.trim();
    }

    // Aggiorna password se fornita
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({
          success: false,
          error: "La password deve contenere almeno 6 caratteri",
        });
      }
      user.passwordHash = await bcrypt.hash(updateData.password, saltRounds);
    }

    // Aggiorna altri campi se forniti
    if (updateData.name !== undefined) user.name = updateData.name.trim();
    if (updateData.surname !== undefined)
      user.surname = updateData.surname.trim();

    // Validazione ruolo
    if (updateData.role) {
      const allowedRoles = ["admin", "issuer", "holder", "verifier"];
      if (!allowedRoles.includes(updateData.role)) {
        return res.status(400).json({
          success: false,
          error: `Ruolo non valido. Ruoli permessi: ${allowedRoles.join(", ")}`,
        });
      }
      user.role = updateData.role;
    }

    // Validazione status
    if (updateData.status) {
      const allowedStatuses = ["active", "inactive", "suspended"];
      if (!allowedStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: `Status non valido. Status permessi: ${allowedStatuses.join(
            ", "
          )}`,
        });
      }
      user.status = updateData.status;
    }

    // Aggiorna isActive
    if (updateData.isActive !== undefined) {
      user.isActive = Boolean(updateData.isActive);
    }

    await user.save();

    return res.json({
      success: true,
      message: "Utente aggiornato con successo",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        surname: user.surname,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Errore durante l'aggiornamento utente:", error);

    // Gestione errori di duplicato MongoDB
    if (error instanceof Error && error.message.includes("E11000")) {
      return res.status(409).json({
        success: false,
        error: "Email o username già registrati",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Errore durante l'aggiornamento utente",
    });
  }
}

/**
 * DELETE /users/:id
 * Elimina un utente
 */
export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId) || userId < 1) {
      return res.status(400).json({
        success: false,
        error: "ID utente non valido (deve essere un numero positivo)",
      });
    }

    const user = await User.findOneAndDelete({ id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Utente non trovato",
      });
    }

    return res.json({
      success: true,
      message: "Utente eliminato con successo",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Errore durante l'eliminazione utente:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante l'eliminazione utente",
    });
  }
}
