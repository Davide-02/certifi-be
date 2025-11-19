import { Request, Response } from "express";
import { getCertificateByHash } from "../utils/db";
import { downloadFile, fileExists } from "../utils/upload";
import { generateSHA256 } from "../utils/hash";
import { verifyOnChain } from "../utils/blockchain";
import { verifySignature } from "../utils/signature";
import fetch from "node-fetch";

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

    // 1. Controlla se esiste nel DB
    const certificate = await getCertificateByHash(targetHash);

    if (!certificate) {
      return res.json({
        verified: false,
        error: "Certificato non trovato nel database",
        hash: targetHash,
        checks: {
          dbExists: false,
          r2Access: null,
          hashMatch: null,
          onChain: null,
          signature: null,
        },
      });
    }

    const checks = {
      dbExists: true,
      r2Access: false,
      hashMatch: false,
      onChain: false,
      signature: false,
    };

    // 2. Controlla R2 access e ricalcola hash
    let fileBuffer: Buffer | null = null;
    let calculatedHash: string | null = null;

    try {
      const exists = await fileExists(certificate.fileKey);
      if (exists) {
        checks.r2Access = true;
        fileBuffer = await downloadFile(certificate.fileKey);
        calculatedHash = generateSHA256(fileBuffer);
        checks.hashMatch = calculatedHash === targetHash;
      }
    } catch (error) {
      console.error("Errore accesso R2:", error);
      checks.r2Access = false;
    }

    // 3. Se presignedUrl è fornito e valido, prova a scaricare e confrontare
    if (qrPayload?.presignedUrl) {
      try {
        const response = await fetch(qrPayload.presignedUrl);
        if (response.ok) {
          const fileData = await response.arrayBuffer();
          const uploadedHash = generateSHA256(Buffer.from(fileData));
          checks.hashMatch = uploadedHash === targetHash;
        }
      } catch (error) {
        console.error("Errore fetch presignedUrl:", error);
      }
    }

    // 4. Confronta con chain
    const chainVerification = await verifyOnChain(targetHash);
    checks.onChain = chainVerification.exists;

    // 5. Verifica firma digitale (se presente nel payload o nel certificato)
    const signatureToVerify = qrPayload?.sig || certificate.signature;
    if (signatureToVerify) {
      try {
        checks.signature = verifySignature(targetHash, signatureToVerify);
      } catch (error) {
        console.error("Errore verifica firma:", error);
        checks.signature = false;
      }
    }

    // Risultato finale: verificato solo se tutti i check passano
    const verified =
      checks.dbExists &&
      checks.r2Access &&
      checks.hashMatch &&
      checks.onChain &&
      checks.signature;

    return res.json({
      verified,
      hash: targetHash,
      certificate: {
        fileKey: certificate.fileKey,
        txHash: certificate.txHash,
        timestamp: certificate.timestamp,
        docType: certificate.docType,
      },
      checks,
      chainVerification: chainVerification.exists
        ? {
            txHash: chainVerification.txHash,
            blockNumber: chainVerification.blockNumber,
          }
        : null,
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
