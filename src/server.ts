import "dotenv/config";
import express from "express";
import multer from "multer";
import cors from "cors";
import { certifyFile } from "./routes/certify";
import { verifyCertificate, verifyByFile } from "./routes/verify";
import { login, register } from "./routes/auth";
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

// Configurazione multer per upload file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Routes
app.post("/auth/register", register);
app.post("/auth/login", login);
app.post("/certify", upload.single("file"), certifyFile);
app.get("/verify", verifyCertificate);
app.post("/verify", upload.single("file"), verifyByFile);

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
    console.log(`📡 CORS configurato per accettare richieste da qualsiasi origine`);
    if (!mongoConnected) {
      console.log(`⚠️  MongoDB non connesso - alcune funzionalità potrebbero non funzionare`);
    }
  });
}

startServer();
