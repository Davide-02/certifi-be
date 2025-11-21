import { Request, Response } from "express";
import { getCertificateByHash } from "../utils/db";
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

    // 1. Verifica hash sulla blockchain PRIMA di tutto
    const chainResponse = await verifyHashOnChain(targetHash);

    // 2. Controlla se esiste nel DB
    const certificate = await getCertificateByHash(targetHash);

    const checks: {
      dbExists: boolean;
      r2Access: boolean | null;
      hashMatch: boolean | null;
      onChain: boolean;
      signature: boolean;
    } = {
      dbExists: !!certificate,
      r2Access: null, // Integrazione S3 disabilitata
      hashMatch: null, // Integrazione S3 disabilitata
      onChain: chainResponse,
      signature: false,
    };

    // 3. Verifica firma digitale (se presente nel payload o nel certificato)
    const signatureToVerify = qrPayload?.sig || certificate?.signature;
    if (signatureToVerify) {
      try {
        checks.signature = verifySignature(targetHash, signatureToVerify);
      } catch (error) {
        console.error("Errore verifica firma:", error);
        checks.signature = false;
      }
    }

    // Risultato finale: verificato se l'hash esiste on-chain
    // Gli altri check (DB, signature) sono informativi ma non bloccanti
    const verified = chainResponse;

    return res.json({
      verified,
      hash: targetHash,
      chainResponse, // Risposta diretta dalla blockchain (true/false)
      certificate: certificate
        ? {
            fileKey: certificate.fileKey,
            txHash: certificate.txHash,
            timestamp: certificate.timestamp,
            docType: certificate.docType,
          }
        : null,
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

    // Cerca certificato nel DB
    const certificate = await getCertificateByHash(targetHash);

    if (!certificate) {
      return res.json({
        verified: false,
        error: "Certificato non trovato",
        hash: targetHash,
        match: false,
      });
    }

    // Se file fornito, confronta hash
    let match = false;
    if (file) {
      const buffer = file.buffer;
      const uploadedHash = generateSHA256(buffer);
      match = uploadedHash === targetHash;
    }

    return res.json({
      verified: match,
      hash: targetHash,
      match,
      certificate: {
        fileKey: certificate.fileKey,
        txHash: certificate.txHash,
        timestamp: certificate.timestamp,
        docType: certificate.docType,
      },
    });
  } catch (error) {
    console.error("Errore durante la verifica POST:", error);
    return res.status(500).json({
      error: "Errore durante la verifica",
      verified: false,
    });
  }
}
