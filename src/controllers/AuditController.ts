import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { ErrorResponse } from "../dto/api.dto";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";

/**
 * Controller for audit logs management
 */
export class AuditController {
  /**
   * GET /audit-logs
   * Get all audit logs (admin only)
   */
  static async getAll(req: TenantRequest, res: Response): Promise<void> {
    try {
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

      if (user.role !== "admin") {
        res.status(403).json({
          success: false,
          error: "Only admins can view all audit logs",
        } as ErrorResponse);
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || "timestamp";
      const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;
      const action = req.query.action as string | undefined;
      const documentId = req.query.document_id as string | undefined;
      const userIdFilter = req.query.user_id as string | undefined;

      const query: Record<string, unknown> = {};
      if (action) query.action = action;
      if (documentId) query.documentId = documentId;
      if (userIdFilter) query.user_id = userIdFilter;

      const logs = await AuditLog.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .populate("user_id", "email username name surname role")
        .exec();

      const totalCount = await AuditLog.countDocuments(query).exec();

      const results = logs.map((log) => ({
        id: log._id.toString(),
        documentId: log.documentId,
        claimId: log.claimId?.toString(),
        user_id: log.user_id
          ? {
              id: (log.user_id as any)._id?.toString(),
              email: (log.user_id as any).email,
              username: (log.user_id as any).username,
              name: (log.user_id as any).name,
              surname: (log.user_id as any).surname,
              role: (log.user_id as any).role,
            }
          : null,
        action: log.action,
        timestamp: log.timestamp.toISOString(),
        notes: log.notes,
        result: log.result,
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
      console.error("Error fetching audit logs:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }
}
