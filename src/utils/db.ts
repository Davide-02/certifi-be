import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";

// Path del file DB (JSON semplice per MVP)
// In produzione, sostituire con database reale (PostgreSQL, MongoDB, etc.)
const DB_PATH = path.join(process.cwd(), "data", "certificates.json");

/**
 * Connette a MongoDB usando MONGODB_URI dal file .env
 */
export async function connectMongoDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI non trovato nel file .env");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connesso a MongoDB");
  } catch (error) {
    console.error("❌ Errore connessione MongoDB:", error);
    throw error;
  }
}

interface CertificateRecord {
  hash: string;
  fileKey: string;
  txHash: string;
  timestamp: number;
  docType: string;
  signature: string;
}

/**
 * Inizializza il file DB se non esiste
 */
async function ensureDbExists(): Promise<void> {
  const dbDir = path.dirname(DB_PATH);
  try {
    await fs.mkdir(dbDir, { recursive: true });
    await fs.access(DB_PATH);
  } catch {
    // File non esiste, crealo vuoto
    await fs.writeFile(DB_PATH, JSON.stringify({}, null, 2));
  }
}

/**
 * Salva un certificato nel DB
 */
export async function saveCertificate(
  record: CertificateRecord
): Promise<void> {
  await ensureDbExists();

  const dbContent = await fs.readFile(DB_PATH, "utf-8");
  const db = JSON.parse(dbContent);

  db[record.hash] = record;

  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Cerca un certificato per hash
 */
export async function getCertificateByHash(
  hash: string
): Promise<CertificateRecord | null> {
  try {
    await ensureDbExists();

    const dbContent = await fs.readFile(DB_PATH, "utf-8");
    const db = JSON.parse(dbContent);

    return db[hash] || null;
  } catch (error) {
    console.error("Errore lettura DB:", error);
    return null;
  }
}

/**
 * Verifica se un hash esiste nel DB
 */
export async function certificateExists(hash: string): Promise<boolean> {
  const record = await getCertificateByHash(hash);
  return record !== null;
}
