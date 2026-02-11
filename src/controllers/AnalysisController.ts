import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { AnalysisService } from "../services/AnalysisService";
import { AuditService } from "../services/AuditService";
import { ErrorResponse } from "../dto/api.dto";
import { v4 as uuidv4 } from "uuid";

/**
 * Controller for document analysis (without certification)
 */
export class AnalysisController {
  /**
   * POST /analyze
   * Analyze a document with AI but do NOT certify on blockchain
   */
  static async analyze(req: TenantRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: "File is required",
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

      const documentId =
        (req.body.document_id as string) || `doc_${uuidv4()}`;
      const requestedTasks = req.body.requested_tasks
        ? Array.isArray(req.body.requested_tasks)
          ? req.body.requested_tasks
          : [req.body.requested_tasks]
        : undefined;

      // Analyze document (NO blockchain interaction)
      const result = await AnalysisService.analyzeDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype || "application/octet-stream",
        userId,
        requestedTasks
      );

      // Return complete analysis results (all AI response data)
      const response = {
        success: true,
        document_id: result.document.id,
        hash: result.document.fileHash,
        analysis: {
          document_family: result.aiAnalysis.document_family,
          document_type: result.aiAnalysis.document_type || result.aiAnalysis.subtype,
          confidence: result.aiAnalysis.confidence || result.aiAnalysis.compliance_score || 0,
          compliance_score: result.aiAnalysis.compliance_score,
          risk_profile: result.aiAnalysis.risk_profile,
          holder: result.aiAnalysis.holder || undefined,
          roles: result.aiAnalysis.roles || undefined,
          claims: result.aiAnalysis.claims || result.aiAnalysis.extracted_claims || {},
          intent: result.aiAnalysis.intent || undefined,
          process_context: result.aiAnalysis.process_context || undefined,
          metadata: result.aiAnalysis.metadata || undefined,
          anomalies: result.aiAnalysis.anomalies || [],
          explainability: result.aiAnalysis.explainability || {
            reasoning: [],
            anomalies: result.aiAnalysis.anomalies || [],
            warnings: [],
          },
        },
        analyzed_at: result.document.updatedAt.toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in document analysis:", error);

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
        documentId: undefined,
        user_id: userObjectId,
        notes: `Document analysis error: ${errorMessage}`,
      });

      res.status(500).json({
        success: false,
        error: errorMessage,
      } as ErrorResponse);
    }
  }
}
