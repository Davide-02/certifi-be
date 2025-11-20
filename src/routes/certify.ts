import { Request, Response } from "express";
import { generateSHA256 } from "../utils/hash";
import { uploadFile, getPresignedUrl } from "../utils/upload";
import { storeHash } from "../utils/blockchain";
import { signHash } from "../utils/signature";
import { saveCertificate } from "../utils/db";

// Configurazione certificatore
const ISSUER = process.env.CERTIFI_ISSUER || "CertiFi";
const CHAIN_ID = process.env.CHAIN_ID || "84532"; // Base Sepolia testnet
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

/**
 * POST /certify
 * Certifica un file: upload, hash, firma, on-chain
 */
export async function certifyFile(req: Request, res: Response) {
  try {
    // Verifica che ci sia un file
    if (!req.file) {
      return res.status(400).json({ error: "File non fornito" });
    }

    const file = req.file;

    // 1. Leggi il file come buffer
    const buffer = file.buffer;

    // 2. Genera hash SHA-256
    const hash = generateSHA256(buffer);

    // 3. Upload file su S3/R2 (bucket privato) - ritorna solo la key
    const fileKey = await uploadFile(buffer, file.originalname, file.mimetype);

    // 4. Genera presigned URL con expiration 5 minuti
    const presignedUrl = await getPresignedUrl(fileKey);

    // 5. Scrivi hash su Base chain
    const txHash = await storeHash(hash);

    // 6. Firma digitale dell'hash (server-side)
    const signature = signHash(hash);

    // 7. Timestamp della certificazione
    const timestamp = Date.now();

    // 8. Tipo documento (estratto dall'estensione)
    const docType =
      file.originalname.split(".").pop()?.toUpperCase() || "UNKNOWN";

    // 9. Crea payload completo per QR code
    const qrPayload = {
      iss: ISSUER,
      hash,
      ts: timestamp,
      docType,
      chainId: CHAIN_ID,
      contract: CONTRACT_ADDRESS,
      sig: signature,
    };

    // 10. Salva certificato nel DB
    await saveCertificate({
      hash,
      fileKey,
      txHash,
      timestamp,
      docType,
      signature,
    });

    // 11. Ritorna risultato (NON include URL pubblico diretto)
    return res.json({
      success: true,
      hash,
      fileKey, // Solo la key, non l'URL pubblico
      presignedUrl, // URL firmato valido 5 minuti
      txHash,
      baseExplorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      qrPayload, // Payload completo per QR code
    });
  } catch (error) {
    console.error("Errore durante la certificazione:", error);
    return res.status(500).json({ error: "Errore durante la certificazione" });
  }
}
