import { Response } from "express";
import { Types } from "mongoose";
import { TenantRequest } from "../middleware/tenant";
import { ErrorResponse } from "../dto/api.dto";
import { DocumentService } from "../services/DocumentService";
import { DocumentModel } from "../services/DocumentService";
import { AuditService } from "../services/AuditService";
import { User } from "../models/User";

/**
 * Controller for document management
 */
export class DocumentController {
  /**
   * Legacy endpoint - kept for backward compatibility
   * Use /analyze + /certify instead
   */
  static async upload(req: TenantRequest, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: "This endpoint is deprecated. Use /analyze first, then /certify",
    } as ErrorResponse);
  }

  /**
   * PATCH /documents/:id/status
   * Update document status
   */
  static async updateStatus(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: "Document ID is required",
        } as ErrorResponse);
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          error: "Status is required",
        } as ErrorResponse);
        return;
      }

      // Validate status
      const allowedStatuses: Array<
        | "pending"
        | "analyzing"
        | "analyzed"
        | "certified"
        | "rejected"
        | "failed"
      > = [
        "pending",
        "analyzing",
        "analyzed",
        "certified",
        "rejected",
        "failed",
      ];

      if (!allowedStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
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

      // Get user and verify role (userId è già l'_id come stringa)
      const user = await User.findById(userId).exec();
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User not found",
        } as ErrorResponse);
        return;
      }

      // Get user ObjectId for audit log
      const userObjectId = user._id;

      // Load document to check if it's certified
      const document = await DocumentService.getById(id);
      if (!document) {
        res.status(404).json({
          success: false,
          error: "Document not found",
        } as ErrorResponse);
        return;
      }

      // If document is certified, verify that the user is the issuer who certified it
      if (document.status === "certified" && document.certification) {
        // Check user role: must be issuer or admin
        if (user.role !== "issuer" && user.role !== "admin") {
          res.status(403).json({
            success: false,
            error: "Only issuers can modify certified documents",
          } as ErrorResponse);
          return;
        }

        // Verify that the current user is the one who certified it (or admin)
        const userObjectId = user._id;
        if (
          user.role !== "admin" &&
          !document.certification.certifiedBy.equals(userObjectId)
        ) {
          res.status(403).json({
            success: false,
            error: "You can only modify documents that you certified",
          } as ErrorResponse);
          return;
        }
      }

      const updatedDocument = await DocumentService.updateStatus(id, status);

      if (!updatedDocument) {
        res.status(404).json({
          success: false,
          error: "Document not found",
        } as ErrorResponse);
        return;
      }

      // Log status update in audit log
      await AuditService.log({
        action: "updated",
        documentId: updatedDocument.id,
        user_id: userObjectId,
        notes: `Document status changed from ${document.status} to ${status}`,
      });

      res.status(200).json({
        success: true,
        document: {
          id: updatedDocument.id,
          status: updatedDocument.status,
          updatedAt: updatedDocument.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating document status:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        success: false,
        error: errorMessage,
      } as ErrorResponse);
    }
  }

  /**
   * PATCH /documents/:id/valid-until
   * Update certification validity end date (only for certified documents)
   */
  static async updateValidUntil(req: TenantRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { valid_until } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: "Document ID is required",
        } as ErrorResponse);
        return;
      }

      const userId = req.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        } as ErrorResponse);
        return;
      }

      const user = await User.findById(userId).exec();
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User not found",
        } as ErrorResponse);
        return;
      }

      if (user.role !== "issuer" && user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Only issuers or admins can update validity date",
        } as ErrorResponse);
        return;
      }

      const document = await DocumentService.getById(id);
      if (!document) {
        res.status(404).json({
          success: false,
          error: "Document not found",
        } as ErrorResponse);
        return;
      }

      if (!document.certification) {
        res.status(400).json({
          success: false,
          error: "Document is not certified",
        } as ErrorResponse);
        return;
      }

      if (
        user.role !== "admin" &&
        !document.certification.certifiedBy.equals(user._id)
      ) {
        res.status(403).json({
          success: false,
          error: "You can only modify documents that you certified",
        } as ErrorResponse);
        return;
      }

      const validUntilDate =
        valid_until === null ||
        valid_until === undefined ||
        valid_until === ""
          ? null
          : new Date(valid_until as string);
      if (validUntilDate !== null && isNaN(validUntilDate.getTime())) {
        res.status(400).json({
          success: false,
          error: "valid_until must be a valid ISO date or null",
        } as ErrorResponse);
        return;
      }

      const updated = await DocumentService.updateCertificationValidUntil(
        id,
        valid_until == null || valid_until === "" ? null : validUntilDate
      );
      if (!updated) {
        res.status(404).json({
          success: false,
          error: "Document not found or not certified",
        } as ErrorResponse);
        return;
      }

      await AuditService.log({
        action: "updated",
        documentId: updated.id,
        user_id: user._id,
        notes: `Valid until updated to ${validUntilDate != null ? validUntilDate.toISOString() : "per sempre"}`,
      });

      res.status(200).json({
        success: true,
        document: {
          id: updated.id,
          status: updated.status,
          valid_until: updated.certification?.validUntil
            ? new Date(updated.certification.validUntil).toISOString()
            : null,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating valid until:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        success: false,
        error: errorMessage,
      } as ErrorResponse);
    }
  }

  /**
   * GET /documents/my-certifications
   * Get all documents certified by the current issuer
   */
  static async getMyCertifications(
    req: TenantRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Extract user ID from request (set by authMiddleware)
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        } as ErrorResponse);
        return;
      }

      // Get user and verify role (userId è già l'_id come stringa)
      const user = await User.findById(userId).exec();
      if (!user) {
        res.status(401).json({
          success: false,
          error: "User not found",
        } as ErrorResponse);
        return;
      }
      // Only issuers and admins can see their certifications
      if (user.role !== "issuer" && user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Only issuers can view their certifications",
        } as ErrorResponse);
        return;
      }

      // Parse query parameters for pagination
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

      const userObjectId = new Types.ObjectId(userId);
      const sortField =
        sortBy === "certifiedAt" ? "certification.certifiedAt" : sortBy;

      const documents = await DocumentModel.find({
        uploadedBy: userObjectId,
      })
        .sort({ [sortField]: sortOrder })
        .skip(offset)
        .limit(limit)
        .exec();

      const totalCount = await DocumentModel.countDocuments({
        uploadedBy: userObjectId,
      }).exec();

      const results = documents.map((document) => ({
        document: {
          id: document.id,
          originalFileName: document.originalFileName,
          fileHash: document.fileHash,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          status: document.status,
          uploadedAt: document.uploadedAt,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
        certification: document.certification
          ? {
              blockchainTxHash: document.certification.blockchainTxHash,
              certifiedAt: document.certification.certifiedAt,
              certificationPolicy: document.certification.certificationPolicy,
              validUntil: document.certification.validUntil
                ? document.certification.validUntil
                : null,
            }
          : null,
      }));

      res.status(200).json({
        success: true,
        data: results,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching my certifications:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(500).json({
        success: false,
        error: errorMessage,
      } as ErrorResponse);
    }
  }

  /**
   * POST /documents/expire-check
   * Check and expire all documents that have passed their validUntil date
   * Can be called periodically (e.g., via cron job)
   */
  static async expireDocuments(req: TenantRequest, res: Response): Promise<void> {
    try {
      const count = await DocumentService.checkAndExpireDocuments();
      res.status(200).json({
        success: true,
        expired_count: count,
        message: `Aggiornati ${count} documenti scaduti`,
      });
    } catch (error) {
      console.error("Error expiring documents:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}
