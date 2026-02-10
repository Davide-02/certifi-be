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
      if (!req.companyId) {
        res.status(401).json({
          success: false,
          error: "Company context required",
        } as ErrorResponse);
        return;
      }

      const { document_id } = req.body;

      if (!document_id) {
        res.status(400).json({
          success: false,
          error: "document_id is required",
        } as ErrorResponse);
        return;
      }

      // Extract user ID from request (in production, from JWT)
      const userId = (req as any).userId || 1; // TODO: Extract from auth middleware

      // Certify document (must be already analyzed)
      const result = await CertificationOnlyService.certifyDocument(
        document_id,
        req.companyId,
        userId
      );

      // Return certification result
      const response = {
        success: true,
        document_id: result.document.id,
        hash: result.document.fileHash,
        certification: {
          tx_hash: result.certification.blockchainTxHash,
          certified_at: result.certification.certifiedAt.toISOString(),
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Error in certification:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await AuditService.log({
        action: "failed",
        documentId: req.body.document_id,
        user_id: null, // TODO: Get user ObjectId from request
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
