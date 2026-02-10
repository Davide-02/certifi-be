import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { ErrorResponse } from "../dto/api.dto";

/**
 * Legacy controller - kept for backward compatibility
 * Use /analyze + /certify instead
 */
export class DocumentController {
  static async upload(req: TenantRequest, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: "This endpoint is deprecated. Use /analyze first, then /certify",
    } as ErrorResponse);
  }
}
