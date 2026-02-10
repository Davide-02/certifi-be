import { Response } from "express";
import { TenantRequest } from "../middleware/tenant";
import { BlockchainService } from "../services/BlockchainService";
import { Certification } from "../models/Certification";
import { generateSHA256 } from "../utils/hash";
import { ErrorResponse } from "../dto/api.dto";

export class VerificationController {
  static async verify(req: TenantRequest, res: Response): Promise<void> {
    try {
      let hash: string | null = null;
      if (req.query.hash) hash = req.query.hash as string;
      else if (req.body.hash) hash = req.body.hash as string;
      else if (req.file) hash = generateSHA256(req.file.buffer);

      if (!hash) {
        res.status(400).json({ success: false, error: "Hash or file is required" } as ErrorResponse);
        return;
      }

      const certification = await Certification.findOne({ fileHash: hash }).exec();
      if (!certification) {
        res.json({ verified: false, hash, status: "not_found" });
        return;
      }

      const blockchainVerify = await BlockchainService.certifyHash(hash);
      res.json({
        verified: true,
        hash,
        status: "verified",
        certified_at: certification.certifiedAt.toISOString(),
        tx_hash: certification.blockchainTxHash,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse);
    }
  }

  static async verifyByHash(req: TenantRequest, res: Response): Promise<void> {
    await VerificationController.verify(req, res);
  }
}
