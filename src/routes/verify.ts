import { Request, Response } from "express";
import { generateSHA256 } from "../utils/hash";
import { verifyHashOnChain } from "../utils/blockchain";
import { verifySignature } from "../utils/signature";

/**
 * GET /verify
 * Verifica un certificato tramite hash o payload base64
 */
export async function verifyCertificate(req: Request, res: Response) {
  try {
    const hash = req.query.hash as string;
    const payloadBase64 = req.query.p as string;

    let targetHash: string | null = null;
    let qrPayload: any = null;

    // Supporta sia ?hash=... che ?p=<base64_payload>
    if (payloadBase64) {
      try {
        const payloadJson = Buffer.from(payloadBase64, "base64").toString(
          "utf-8"
        );
        qrPayload = JSON.parse(payloadJson);
        targetHash = qrPayload.hash;
      } catch (error) {
        return res.status(400).json({
          error: "Payload base64 non valido",
          verified: false,
        });
      }
    } else if (hash) {
      targetHash = hash;
    } else {
      return res.status(400).json({
        error: "Parametro hash o p (payload) mancante",
        verified: false,
      });
    }

    if (!targetHash) {
      return res.status(400).json({
        error: "Hash non trovato",
        verified: false,
      });
    }

    // 1. Verifica hash sulla blockchain
    const chainResponse = await verifyHashOnChain(targetHash);

    const checks = {
      onChain: chainResponse,
      signature: false,
    };

    // 3. Verifica firma digitale (se presente nel payload o nel certificato)
    const signatureToVerify = qrPayload?.sig;
    if (signatureToVerify) {
      try {
        checks.signature = verifySignature(targetHash, signatureToVerify);
      } catch (error) {
        console.error("Errore verifica firma:", error);
        checks.signature = false;
      }
    }

    // Risultato finale: verificato se hash esiste on-chain e, se presente,
    // la firma è valida
    const signatureRequired = Boolean(signatureToVerify);
    const verified = chainResponse && (!signatureRequired || checks.signature);

    return res.json({
      verified,
      hash: targetHash,
      chainResponse, // Risposta diretta dalla blockchain (true/false)
      certificate: null,
      checks,
      qrPayload: qrPayload || null,
    });
  } catch (error) {
    console.error("Errore durante la verifica:", error);
    return res.status(500).json({
      error: "Errore durante la verifica",
      verified: false,
    });
  }
}

/**
 * POST /verify
 * Verifica tramite upload file
 */
export async function verifyByFile(req: Request, res: Response) {
  try {
    const file = req.file;
    const hash = req.body.hash as string;

    if (!file && !hash) {
      return res.status(400).json({
        error: "File o hash richiesto",
        verified: false,
      });
    }

    let targetHash = hash;

    // Se file fornito, calcola hash
    if (file) {
      const buffer = file.buffer;
      const calculatedHash = generateSHA256(buffer);
      targetHash = calculatedHash;
    }

    if (!targetHash) {
      return res.status(400).json({
        error: "Hash non disponibile",
        verified: false,
      });
    }

    let fileMatch: boolean | null = null;
    if (file) {
      const buffer = file.buffer;
      const uploadedHash = generateSHA256(buffer);
      fileMatch = uploadedHash === targetHash;
      targetHash = uploadedHash;
    }

    const chainResponse = await verifyHashOnChain(targetHash);
    const verified = chainResponse && fileMatch !== false;

    return res.json({
      verified,
      hash: targetHash,
      chainResponse,
      fileMatch,
    });
  } catch (error) {
    console.error("Errore durante la verifica POST:", error);
    return res.status(500).json({
      error: "Errore durante la verifica",
      verified: false,
    });
  }
}
