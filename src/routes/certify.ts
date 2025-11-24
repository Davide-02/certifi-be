import { Request, Response } from "express";
import { generateSHA256 } from "../utils/hash";
import { storeHash, verifyHashOnChain } from "../utils/blockchain";
import { signHash } from "../utils/signature";

// Configurazione certificatore
const ISSUER = process.env.CERTIFI_ISSUER || "CertiFi";
const CHAIN_ID = process.env.CHAIN_ID || "84532"; // Base Sepolia testnet
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

function formatBlockchainError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const anyError = error as {
      code?: string;
      shortMessage?: string;
      message?: string;
      info?: unknown;
    };
    return {
      code: anyError.code,
      shortMessage: anyError.shortMessage,
      message: anyError.message || "Errore sconosciuto durante la transazione",
      info: anyError.info,
    };
  }

  return {
    message: "Errore sconosciuto durante la transazione",
  };
}

function auditLog(
  event: string,
  payload: Record<string, string | number | boolean | null>
) {
  console.log(`[CertiFi][audit] ${event}`, payload);
}

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
      auditLog("duplicate-certification-attempt", {
        hash,
        timestamp: Date.now(),
      });
      return res.status(409).json({
        success: false,
        error: "File già certificato",
        hash,
      });
    }

    // 4. Scrivi hash su Base chain
    let txHash: string;
    try {
      txHash = await storeHash(hash);
    } catch (error) {
      const formattedError = formatBlockchainError(error);
      console.error("Errore durante la scrittura on-chain:", error);
      auditLog("certification-failed", {
        hash,
        timestamp: Date.now(),
        reason: formattedError.shortMessage || formattedError.message,
      });
      return res.status(502).json({
        success: false,
        error: "Scrittura on-chain fallita",
        details: formattedError,
      });
    }

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
    auditLog("certification-success", {
      hash,
      txHash,
      timestamp,
    });

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
