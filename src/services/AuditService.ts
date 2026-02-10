export class AuditService {
  static async log(data: {
    eventType: string;
    companyId?: number | null;
    documentId?: string | null;
    userId?: number | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    console.log(`[Audit] ${data.eventType}`, {
      companyId: data.companyId,
      documentId: data.documentId,
      userId: data.userId,
      metadata: data.metadata,
    });
    // In production, save to MongoDB AuditLog collection
  }
}
