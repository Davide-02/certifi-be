import "dotenv/config";
import express from "express";
import multer from "multer";
import cors from "cors";
import { certifyFile } from "./routes/certify";
import { verifyCertificate, verifyByFile } from "./routes/verify";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione multer per upload file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Routes
app.post("/certify", upload.single("file"), certifyFile);
app.get("/verify", verifyCertificate);
app.post("/verify", upload.single("file"), verifyByFile);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
