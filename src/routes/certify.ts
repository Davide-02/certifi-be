import { Request, Response } from "express";
import fetch from "node-fetch";
import { generateSHA256 } from "../utils/hash";
import { storeHash, verifyHashOnChain } from "../utils/blockchain";
import { signHash } from "../utils/signature";

// Configurazione certificatore
const ISSUER = process.env.CERTIFI_ISSUER || "CertiFi";
const CHAIN_ID = process.env.CHAIN_ID || "84532"; // Base Sepolia testnet
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

// Configurazione servizio AI
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_VERSION = process.env.AI_VERSION || "v1.0";

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

interface AIAnalysisRequest {
  document_id: string;
  hash: string;
  requested_tasks: string[];
  ai_version: string;
}

interface AIAnalysisResponse {
  document_family?: string;
  document_type?: string;
  holder?: {
    type: string;
    ref: string;
    confidence: number;
  };
  claims?: Record<string, unknown>;
  compliance_score?: number;
  anomalies?: unknown[];
}

/**
 * Chiama il servizio AI per analizzare il documento
 */
async function analyzeDocument(
  documentId: string,
  hash: string,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  requestedTasks?: string[]
): Promise<AIAnalysisResponse> {
  const defaultTasks = [
    "classify",
    "extract",
    "claims",
    "holder",
    "compliance_score",
  ];

  // Costruisci manualmente il body multipart/form-data
  const boundary = `----CertiFi-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const CRLF = "\r\n";
  
  const parts: Buffer[] = [];
  
  // Aggiungi document_id
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="document_id"${CRLF}${CRLF}`));
  parts.push(Buffer.from(documentId));
  parts.push(Buffer.from(CRLF));
  
  // Aggiungi hash
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="hash"${CRLF}${CRLF}`));
  parts.push(Buffer.from(hash));
  parts.push(Buffer.from(CRLF));
  
  // Aggiungi requested_tasks
  const tasksString = (requestedTasks || defaultTasks).join(",");
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="requested_tasks"${CRLF}${CRLF}`));
  parts.push(Buffer.from(tasksString));
  parts.push(Buffer.from(CRLF));
  
  // Aggiungi ai_version
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="ai_version"${CRLF}${CRLF}`));
  parts.push(Buffer.from(AI_VERSION));
  parts.push(Buffer.from(CRLF));
  
  // Aggiungi file
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`));
  parts.push(Buffer.from(`Content-Type: ${contentType}${CRLF}${CRLF}`));
  parts.push(fileBuffer);
  parts.push(Buffer.from(CRLF));
  
  // Chiudi boundary
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));
  
  const body = Buffer.concat(parts);

  console.log(`[CertiFi][ai] analyzeDocument:request`, {
    url: `${AI_SERVICE_URL}/analyze`,
    document_id: documentId,
    hash,
    requested_tasks: tasksString,
    ai_version: AI_VERSION,
    filename: fileName,
    contentType: contentType,
    fileSize: fileBuffer.length,
    bodySize: body.length,
  });

  const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CertiFi][ai] analyzeDocument:error`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(
      `AI Service error (${response.status}): ${errorText || response.statusText}`
    );
  }

  const result = (await response.json()) as AIAnalysisResponse;
  console.log(`[CertiFi][ai] analyzeDocument:success`, {
    document_id: documentId,
    hash,
    document_family: result.document_family,
    document_type: result.document_type,
    compliance_score: result.compliance_score,
    has_holder: !!result.holder,
    has_claims: !!result.claims,
    anomalies_count: result.anomalies?.length || 0,
  });

  return result;
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

    // 3.5. Analisi AI del documento prima della registrazione on-chain
    const documentId = req.body.document_id || `doc_${Date.now()}`;
    const requestedTasks = req.body.requested_tasks
      ? Array.isArray(req.body.requested_tasks)
        ? req.body.requested_tasks
        : [req.body.requested_tasks]
      : undefined;

    let aiAnalysis: AIAnalysisResponse | null = null;
    try {
      aiAnalysis = await analyzeDocument(
        documentId,
        hash,
        buffer,
        file.originalname,
        file.mimetype || "application/octet-stream",
        requestedTasks
      );
      auditLog("ai-analysis-success", {
        documentId,
        hash,
        timestamp: Date.now(),
        document_family: aiAnalysis.document_family || null,
        document_type: aiAnalysis.document_type || null,
        compliance_score: aiAnalysis.compliance_score ?? null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Errore sconosciuto AI";
      console.error("Errore durante l'analisi AI:", error);
      auditLog("ai-analysis-failed", {
        documentId,
        hash,
        timestamp: Date.now(),
        reason: errorMessage,
      });
      return res.status(502).json({
        success: false,
        error: "Analisi AI fallita",
        details: errorMessage,
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
      aiAnalysis, // Risultati dell'analisi AI
    });
  } catch (error) {
    console.error("Errore durante la certificazione:", error);
    return res.status(500).json({ error: "Errore durante la certificazione" });
  }
}
