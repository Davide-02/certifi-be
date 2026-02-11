import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { CertificationOnlyService } from "../services/CertificationOnlyService";
import { AuditService } from "../services/AuditService";
import { ErrorResponse } from "../dto/api.dto";

/**
 * Controller for certification only (document must be already analyzed)
 */
export class CertificationController {
  /**
   * POST /certify
   * Certify an already-analyzed document on blockchain
   */
  static async certify(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { document_id, valid_until } = req.body;

      if (!document_id) {
        res.status(400).json({
          success: false,
          error: "document_id is required",
        } as ErrorResponse);
        return;
      }

      // Extract user ID from request (set by authMiddleware)
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        } as ErrorResponse);
        return;
      }

      const validUntil =
        valid_until === null || valid_until === undefined || valid_until === ""
          ? null
          : valid_until;

      const result = await CertificationOnlyService.certifyDocument(
        document_id,
        userId,
        validUntil
      );

      const response = {
        success: true,
        document_id: result.document.id,
        hash: result.document.fileHash,
        certification: {
          tx_hash: result.certification.blockchainTxHash,
          certified_at: result.certification.certifiedAt.toISOString(),
          valid_until: result.certification.validUntil
            ? result.certification.validUntil.toISOString()
            : null,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error in certification:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Try to get user ObjectId if userId is available
      let userObjectId = null;
      if (req.userId) {
        try {
          // userId è già l'_id come stringa, convertiamo in ObjectId
          const { Types } = await import("mongoose");
          userObjectId = new Types.ObjectId(req.userId);
        } catch {
          // Ignore error
        }
      }

      await AuditService.log({
        action: "failed",
        documentId: req.body.document_id,
        user_id: userObjectId,
        notes: `Certification error: ${errorMessage}`,
      });

      const statusCode =
        errorMessage.includes("not found") ||
        errorMessage.includes("must be analyzed")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      } as ErrorResponse);
    }
  }
}
