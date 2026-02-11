import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { BlockchainService } from "../services/BlockchainService";
import { DocumentService } from "../services/DocumentService";
import { generateSHA256 } from "../utils/hash";
import { ErrorResponse } from "../dto/api.dto";

export class VerificationController {
  static async verify(req: TenantRequest, res: Response): Promise<void> {
    try {
      let hash: string | null = null;
      if (req.query.hash) hash = req.query.hash as string;
      else if (req.body.hash) hash = req.body.hash as string;
      else if (req.file) hash = generateSHA256(req.file.buffer);

      if (!hash) {
        res.status(400).json({ success: false, error: "Hash or file is required" } as ErrorResponse);
        return;
      }

      const document = await DocumentService.findByFileHash(hash);
      if (!document) {
        res.json({
          verified: false,
          hash,
          status: "not_found",
          message: "Nessun documento con questo hash",
          document: null,
          certification: null,
          on_chain_status: null,
        });
        return;
      }

      const documentData = {
        id: document.id,
        originalFileName: document.originalFileName,
        fileHash: document.fileHash,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        status: document.status,
        uploadedAt: document.uploadedAt?.toISOString?.(),
        createdAt: document.createdAt?.toISOString?.(),
        updatedAt: document.updatedAt?.toISOString?.(),
        roles: document.roles ?? [],
      };

      const certificationData = document.certification
        ? {
            blockchainTxHash: document.certification.blockchainTxHash,
            certifiedAt: document.certification.certifiedAt.toISOString(),
            validUntil: document.certification.validUntil
              ? new Date(document.certification.validUntil).toISOString()
              : null,
            certificationPolicy: document.certification.certificationPolicy,
          }
        : null;

      const onChain = await BlockchainService.isHashCertifiedOnChain(hash);
      const validUntil = document.certification?.validUntil;
      const isExpired =
        validUntil != null && new Date(validUntil) < new Date();

      if (isExpired && document.status === "certified") {
        await DocumentService.checkAndExpireDocument(document.id);
        document.status = "expired";
        documentData.status = "expired";
      }

      let verified: boolean;
      let status: string;
      let message: string | undefined;

      if (document.status === "certified" || document.status === "expired") {
        if (document.certification) {
          if (onChain) {
            verified = !isExpired;
            status = isExpired ? "expired" : "verified";
            message = isExpired
              ? "Documento certificato ma scaduto (validità superata)."
              : undefined;
          } else {
            verified = false;
            status = "blockchain_mismatch";
            message = "Documento non trovato sulla blockchain.";
          }
        } else {
          verified = false;
          status = document.status || "not_certified";
        }
      } else {
        verified = false;
        status = document.status || "not_certified";
        message =
          status === "analyzed"
            ? "Documento analizzato, non ancora certificato."
            : status === "pending" || status === "analyzing"
              ? "Documento in elaborazione."
              : status === "rejected" || status === "failed"
                ? "Documento non certificabile."
                : undefined;
      }

      res.json({
        hash,
        verified,
        status,
        message,
        is_expired: document.certification ? isExpired : undefined,
        valid_until: certificationData?.validUntil ?? undefined,
        on_chain_status: onChain ? "registered" : "not_registered",
        document: documentData,
        certification: certificationData,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  static async verifyByHash(req: TenantRequest, res: Response): Promise<void> {
    await VerificationController.verify(req, res);
  }
}
