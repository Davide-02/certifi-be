import { AuditLog, IAuditLog } from "../models/AuditLog";
import { Types } from "mongoose";

export class AuditService {
  static async log(data: {
    action: string;
    documentId?: string | null;
    user_id?: string | Types.ObjectId | null;
    notes?: string;
  }): Promise<IAuditLog> {
    const auditLog = new AuditLog({
      documentId: data.documentId ?? null,
      user_id: data.user_id 
        ? (typeof data.user_id === "string" ? new Types.ObjectId(data.user_id) : data.user_id)
        : null,
      action: data.action,
      notes: data.notes || "",
      timestamp: new Date(),
    });

    await auditLog.save();

    // Also log to console for development
    console.log(`[Audit] ${data.action}`, {
      documentId: data.documentId,
      user_id: data.user_id,
      notes: data.notes,
    });

    return auditLog;
  }

  static async getDocumentLogs(
    documentId: string,
    limit: number = 100
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ documentId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  static async getUserLogs(
    user_id: string | Types.ObjectId,
    limit: number = 100
  ): Promise<IAuditLog[]> {
    const userId = typeof user_id === "string" ? new Types.ObjectId(user_id) : user_id;
    return AuditLog.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}
