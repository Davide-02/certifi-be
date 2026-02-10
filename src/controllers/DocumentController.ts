import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { ErrorResponse } from "../dto/api.dto";
import { DocumentService } from "../services/DocumentService";
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
}
