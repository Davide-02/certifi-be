import "dotenv/config";
import express from "express";
import cors from "cors";
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

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware CORS - configurazione per permettere tutte le origini
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Permetti tutte le origini in sviluppo
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "X-Company-Id",
    "X-Company-Slug",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400, // 24 ore
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - Auth
app.post("/auth/register", register);
app.post("/auth/login", login);

// Routes - Users
app.post("/users", createUser);
app.get("/users", getUsers);
app.get("/users/:id", getUserById);
app.put("/users/:id", updateUser);
app.patch("/users/:id", patchUser);
app.delete("/users/:id", deleteUser);

// Routes - Analysis (analyze document with AI, NO blockchain)
app.use("/analyze", analyzeRouter);

// Routes - Certification (certify already-analyzed document on blockchain)
app.use("/certify", certifyRouter);

// Routes - Documents (legacy - full flow, kept for backward compatibility)
app.use("/documents", documentsRouter);

// Routes - Verification (public endpoint)
app.use("/verify", verificationRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

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
