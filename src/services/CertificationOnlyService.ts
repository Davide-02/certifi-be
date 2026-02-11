import { ICompany } from "../models/Company";
import { AIAnalysis } from "../models/AIAnalysis";
import { BlockchainService } from "./BlockchainService";
import {
  DocumentService,
  IDocument,
  CertificationData,
} from "./DocumentService";
import { AuditService } from "./AuditService";
import { User } from "../models/User";
import { Types } from "mongoose";
import { ensureCompany } from "../utils/ensureCompany";

/**
 * Service for certification only (document must be already analyzed)
 * Certifies an already-analyzed document on blockchain
 */
export class CertificationOnlyService {
  /**
   * Get User MongoDB ObjectId from _id string
   */
  private static async getUserObjectId(userId: string): Promise<Types.ObjectId | null> {
    try {
      // userId è già l'_id come stringa, convertiamo in ObjectId
      return new Types.ObjectId(userId);
    } catch {
      return null;
    }
  }
  /**
   * Certify an already-analyzed document:
   * 1. Load document and AI analysis
   * 2. Check company certification policy
   * 3. Verify via blockchain if hash is already certified (skip duplicate)
   * 4. If not on chain: send to blockchain
   * 5. Create certification record
   */
  static async certifyDocument(
    documentId: string,
    userId: string, // MongoDB _id come stringa
    validUntil?: string | Date | null // ISO string o Date; null/omit = per sempre
  ): Promise<{
    document: IDocument;
    certification: CertificationData;
  }> {
    // 1. Load document
    const document = await DocumentService.getById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    if (document.status !== "analyzed") {
      throw new Error(
        `Document must be analyzed before certification. Current status: ${document.status}`
      );
    }

    // 2. Load latest AI analysis
    const aiAnalysis = await AIAnalysis.findOne({
      documentId: document.id,
      companyId: 1,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!aiAnalysis) {
      throw new Error(`AI analysis not found for document ${documentId}`);
    }

    // 3. Get company certification policy (create default if doesn't exist)
    const company = await ensureCompany(1);

    // 4. Make certification decision based on policy
    const decision = this.makeCertificationDecision(aiAnalysis, company);

    if (!decision.certifiable) {
      await DocumentService.updateStatus(document.id, "rejected");
      await AuditService.log({
        action: "rejected",
        documentId: document.id,
        user_id: await this.getUserObjectId(userId),
        notes: `Certification rejected: ${decision.reason} (family: ${aiAnalysis.documentFamily}, confidence: ${aiAnalysis.confidence})`,
      });

      throw new Error(decision.reason || "Document does not meet certification policy");
    }

    // 5. Check if hash already on blockchain (avoid duplicate certification)
    const alreadyOnChain = await BlockchainService.isHashCertifiedOnChain(
      document.fileHash
    );
    if (alreadyOnChain) {
      const existingDocWithHash = await DocumentService.findCertifiedByFileHash(
        document.fileHash
      );
      if (existingDocWithHash?.certification) {
        if (existingDocWithHash.id === document.id) {
          throw new Error(
            "Documento già certificato. Questo documento è stato già certificato sulla blockchain."
          );
        }
        const userObjectId = await this.getUserObjectId(userId);
        if (!userObjectId) {
          throw new Error(`Invalid user ID: ${userId}`);
        }
        const validUntilDate = this.parseValidUntil(validUntil);
        const certification: CertificationData = {
          blockchainTxHash: existingDocWithHash.certification.blockchainTxHash,
          certificationPolicy: {
            documentFamily: aiAnalysis.documentFamily,
            confidence: aiAnalysis.confidence,
            policyVersion: "1.0",
          },
          certifiedAt: new Date(),
          certifiedBy: userObjectId,
          validUntil: validUntilDate ?? existingDocWithHash.certification.validUntil ?? null,
        };
        const updated = await DocumentService.setCertification(
          document.id,
          certification
        );
        if (!updated) throw new Error(`Failed to certify document ${documentId}`);
        await AuditService.log({
          action: "verified",
          documentId: document.id,
          user_id: userObjectId,
          notes: `Document already certified on blockchain. Reused TX: ${existingDocWithHash.certification.blockchainTxHash}`,
        });
        return { document: updated, certification };
      }
      throw new Error(
        "File già certificato sulla blockchain. Questo hash è stato certificato precedentemente da un altro sistema."
      );
    }

    // 6. Send to blockchain (first time for this hash)
    let blockchainResponse;
    try {
      blockchainResponse = await BlockchainService.certifyHash(
        document.fileHash,
        {
          document_family: aiAnalysis.documentFamily,
        }
      );

      const userObjectId = await this.getUserObjectId(userId);
      if (!userObjectId) {
        throw new Error(`Invalid user ID: ${userId}`);
      }

      const validUntilDate = this.parseValidUntil(validUntil);
      const certification: CertificationData = {
        blockchainTxHash: blockchainResponse.tx_hash,
        certificationPolicy: {
          documentFamily: aiAnalysis.documentFamily,
          confidence: aiAnalysis.confidence,
          policyVersion: "1.0",
        },
        certifiedAt: new Date(),
        certifiedBy: userObjectId,
        validUntil: validUntilDate ?? null,
      };

      const updated = await DocumentService.setCertification(
        document.id,
        certification
      );
      if (!updated) throw new Error(`Failed to certify document ${documentId}`);

      await AuditService.log({
        action: "verified",
        documentId: document.id,
        user_id: await this.getUserObjectId(userId),
        notes: `Document certified on blockchain. TX: ${blockchainResponse.tx_hash}, family: ${aiAnalysis.documentFamily}, confidence: ${aiAnalysis.confidence}`,
      });

      return {
        document: updated,
        certification,
      };
    } catch (error) {
      await DocumentService.updateStatus(document.id, "failed");
      await AuditService.log({
        action: "failed",
        documentId: document.id,
        user_id: await this.getUserObjectId(userId),
        notes: `Certification failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      throw error;
    }
  }

  private static parseValidUntil(
    validUntil?: string | Date | null
  ): Date | null {
    if (validUntil === null || validUntil === undefined || validUntil === "") {
      return null;
    }
    if (validUntil instanceof Date) {
      return isNaN(validUntil.getTime()) ? null : validUntil;
    }
    const d = new Date(validUntil);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Make certification decision based on company policy
   * NEVER overrides AI classification - only checks policy rules
   */
  private static makeCertificationDecision(
    aiAnalysis: {
      documentFamily: string;
      confidence: number;
    },
    company: ICompany
  ): { certifiable: boolean; reason?: string } {
    const policy = company.settings.certificationPolicy;

    // Log low confidence but do not block certification (certify anyway)
    if (aiAnalysis.confidence < policy.minConfidence) {
      console.warn(
        `[CertificationOnlyService] Low confidence (${aiAnalysis.confidence}) below threshold (${policy.minConfidence}) - certifying anyway per policy`
      );
    }

    // Check allowed document families (if whitelist is set)
    if (
      policy.allowedDocumentFamilies.length > 0 &&
      !policy.allowedDocumentFamilies.includes(aiAnalysis.documentFamily)
    ) {
      return {
        certifiable: false,
        reason: `Document family ${aiAnalysis.documentFamily} not in allowed list`,
      };
    }

    // Check if manual review is required
    if (policy.requireManualReview) {
      return {
        certifiable: false,
        reason: "Manual review required by policy",
      };
    }

    return { certifiable: true };
  }
}
