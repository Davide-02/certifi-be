import { Request, Response } from "express";
import { generateSHA256 } from "../utils/hash";
import { storeHash, verifyHashOnChain } from "../utils/blockchain";
import { signHash } from "../utils/signature";

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

    // 3. Controlla se l'hash esiste già on-chain
    const alreadyCertified = await verifyHashOnChain(hash);
    if (alreadyCertified) {
      return res.status(409).json({
        success: false,
        error: "File già certificato",
        hash,
      });
    }

    // 4. Scrivi hash su Base chain
    const txHash = await storeHash(hash);

    // 5. Firma digitale dell'hash (server-side)
    const signature = signHash(hash);

    // 6. Timestamp della certificazione
    const timestamp = Date.now();

    // 7. Tipo documento (estratto dall'estensione)
    const docType =
      file.originalname.split(".").pop()?.toUpperCase() || "UNKNOWN";

    // 8. Crea payload completo per QR code
    const qrPayload = {
      iss: ISSUER,
      hash,
      ts: timestamp,
      docType,
      chainId: CHAIN_ID,
      contract: CONTRACT_ADDRESS,
      sig: signature,
    };

    // 9. Ritorna risultato (senza storage persistente)
    return res.json({
      success: true,
      hash,
      txHash,
      baseExplorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      signature,
      timestamp,
      docType,
      qrPayload, // Payload completo per QR code
    });
  } catch (error) {
    console.error("Errore durante la certificazione:", error);
    return res.status(500).json({ error: "Errore durante la certificazione" });
  }
}
