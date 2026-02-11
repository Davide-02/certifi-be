import "dotenv/config";
import express from "express";
import { login, register } from "./routes/auth";
import {
  createUser,
  getUserById,
  getUsers,
  updateUser,
  patchUser,
  deleteUser,
} from "./routes/users";
import analyzeRouter from "./routes/analyze";
import certifyRouter from "./routes/certify";
import verificationRouter from "./routes/verification";
import documentsRouter from "./routes/documents";
import { connectMongoDB } from "./utils/db";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// CORS: unico middleware che gestisce tutto (preflight + header su ogni risposta)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - Auth (pubbliche, non richiedono autenticazione)
// Solo login e register sono pubbliche per permettere l'autenticazione iniziale
app.post("/auth/register", register);
app.post("/auth/login", login);

// Health check (pubblico - utile per monitoring)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Tutte le route seguenti richiedono autenticazione JWT
app.use(authMiddleware);

// Routes - Verification (protetta - richiede autenticazione)
app.use("/verify", verificationRouter);

// Routes - Users (protette)
app.post("/users", createUser);
app.get("/users", getUsers);
app.get("/users/:id", getUserById);
app.put("/users/:id", updateUser);
app.patch("/users/:id", patchUser);
app.delete("/users/:id", deleteUser);

// Routes - Analysis (analyze document with AI, NO blockchain) (protetta)
app.use("/analyze", analyzeRouter);

// Routes - Certification (certify already-analyzed document on blockchain) (protetta)
app.use("/certify", certifyRouter);

// Routes - Documents (legacy - full flow, kept for backward compatibility) (protetta)
app.use("/documents", documentsRouter);

// Avvia server e connetti a MongoDB
async function startServer() {
  let mongoConnected = false;

  try {
    // Connetti a MongoDB
    await connectMongoDB();
    mongoConnected = true;
  } catch (error) {
    console.error("❌ Errore connessione MongoDB:", error);
    console.log("⚠️  Avvio server senza MongoDB (solo per test)");
  }

  // Avvia il server in ogni caso
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(
      `📡 CORS configurato per accettare richieste da qualsiasi origine`
    );
    if (!mongoConnected) {
      console.log(
        `⚠️  MongoDB non connesso - alcune funzionalità potrebbero non funzionare`
      );
    }
  });
}

startServer();
