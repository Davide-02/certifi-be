import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { ErrorResponse } from "../dto/api.dto";
import { DocumentService } from "../services/DocumentService";
import { DocumentModel } from "../services/DocumentService";
import { AuditService } from "../services/AuditService";
import { User } from "../models/User";
import { Certification } from "../models/Certification";
import { Types } from "mongoose";

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
      if (!req.companyId) {
        res.status(401).json({
          success: false,
          error: "Company context required",
        } as ErrorResponse);
        return;
      }

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
      const allowedStatuses: Array<"pending" | "analyzing" | "analyzed" | "certified" | "rejected" | "failed"> = [
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

      // Extract user ID from request (in production, from JWT)
      const userId = (req as any).userId; // TODO: Extract from auth middleware

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        } as ErrorResponse);
        return;
      }

      // Get user and verify role
      const user = await User.findOne({ id: userId }).exec();
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
      const document = await DocumentService.getById(id, req.companyId);
      if (!document) {
        res.status(404).json({
          success: false,
          error: "Document not found",
        } as ErrorResponse);
        return;
      }

      // If document is certified, verify that the user is the issuer who certified it
      if (document.status === "certified") {
        // Check user role: must be issuer or admin
        if (user.role !== "issuer" && user.role !== "admin") {
          res.status(403).json({
            success: false,
            error: "Only issuers can modify certified documents",
          } as ErrorResponse);
          return;
        }

        // Find the certification record
        const certification = await Certification.findOne({
          documentId: document.id,
          companyId: req.companyId,
        }).exec();

        if (!certification) {
          res.status(404).json({
            success: false,
            error: "Certification record not found",
          } as ErrorResponse);
          return;
        }

        // Verify that the current user is the one who certified it (or admin)
        if (user.role !== "admin" && certification.certifiedBy !== userId) {
          res.status(403).json({
            success: false,
            error: "You can only modify documents that you certified",
          } as ErrorResponse);
          return;
        }
      }

      // Update status with company check (ensures multi-tenant isolation)
      const updatedDocument = await DocumentService.updateStatusWithCompanyCheck(
        id,
        req.companyId,
        status
      );

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
   * GET /documents/my-certifications
   * Get all documents certified by the current issuer
   */
  static async getMyCertifications(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.companyId) {
        res.status(401).json({
          success: false,
          error: "Company context required",
        } as ErrorResponse);
        return;
      }

      // Extract user ID from request (in production, from JWT)
      const userId = (req as any).userId; // TODO: Extract from auth middleware

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        } as ErrorResponse);
        return;
      }

      // Get user and verify role
      const user = await User.findOne({ id: userId }).exec();
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
      const sortBy = (req.query.sortBy as string) || "certifiedAt";
      const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

      // Find all certifications by this issuer in this company
      const certifications = await Certification.find({
        certifiedBy: userId,
        companyId: req.companyId,
      })
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .exec();

      // Get total count for pagination
      const totalCount = await Certification.countDocuments({
        certifiedBy: userId,
        companyId: req.companyId,
      }).exec();

      // Get document IDs from certifications
      const documentIds = certifications.map((cert) => cert.documentId);

      // Fetch all documents
      const documents = await DocumentModel.find({
        id: { $in: documentIds },
        companyId: req.companyId,
      }).exec();

      // Create a map for quick lookup
      const documentMap = new Map(documents.map((doc) => [doc.id, doc]));

      // Combine certification and document data
      const results = certifications
        .map((cert) => {
          const document = documentMap.get(cert.documentId);
          if (!document) {
            return null; // Skip if document not found
          }

          return {
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
            certification: {
              blockchainTxHash: cert.blockchainTxHash,
              certifiedAt: cert.certifiedAt,
              certificationPolicy: cert.certificationPolicy,
            },
          };
        })
        .filter((item) => item !== null);

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
}
