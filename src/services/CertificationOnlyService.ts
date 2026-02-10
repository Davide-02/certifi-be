import { Company, ICompany } from "../models/Company";
import { Certification, ICertification } from "../models/Certification";
import { AIAnalysis } from "../models/AIAnalysis";
import { BlockchainService } from "./BlockchainService";
import { DocumentService, IDocument } from "./DocumentService";
import { AuditService } from "./AuditService";

/**
 * Service for certification only (document must be already analyzed)
 * Certifies an already-analyzed document on blockchain
 */
export class CertificationOnlyService {
  /**
   * Certify an already-analyzed document:
   * 1. Load document and AI analysis
   * 2. Check company certification policy
   * 3. If certifiable, send to blockchain
   * 4. Create certification record
   */
  static async certifyDocument(
    documentId: string,
    companyId: number,
    userId: number
  ): Promise<{
    document: IDocument;
    certification: ICertification;
  }> {
    // 1. Load document
    const document = await DocumentService.getById(documentId, companyId);
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
      companyId,
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!aiAnalysis) {
      throw new Error(`AI analysis not found for document ${documentId}`);
    }

    // 3. Get company certification policy
    const company = await Company.findOne({ id: companyId }).exec();
    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    // 4. Make certification decision based on policy
    const decision = this.makeCertificationDecision(aiAnalysis, company);

    if (!decision.certifiable) {
      await DocumentService.updateStatus(document.id, "rejected");
      await AuditService.log({
        eventType: "certification.rejected",
        companyId,
        documentId: document.id,
        userId,
        metadata: {
          reason: decision.reason,
          documentFamily: aiAnalysis.documentFamily,
          confidence: aiAnalysis.confidence,
        },
      });

      throw new Error(decision.reason || "Document does not meet certification policy");
    }

    // 5. Send to blockchain
    let blockchainResponse;
    try {
      blockchainResponse = await BlockchainService.certifyHash(
        document.fileHash,
        {
          document_family: aiAnalysis.documentFamily,
          company_id: companyId,
        }
      );

      // 6. Create certification record
      const certification = new Certification({
        documentId: document.id,
        companyId,
        fileHash: document.fileHash,
        blockchainTxHash: blockchainResponse.tx_hash,
        certificationPolicy: {
          documentFamily: aiAnalysis.documentFamily,
          confidence: aiAnalysis.confidence,
          policyVersion: "1.0",
        },
        certifiedAt: new Date(),
        certifiedBy: userId,
      });

      await certification.save();

      await DocumentService.updateStatus(document.id, "certified");

      await AuditService.log({
        eventType: "certification.created",
        companyId,
        documentId: document.id,
        userId,
        metadata: {
          txHash: blockchainResponse.tx_hash,
          documentFamily: aiAnalysis.documentFamily,
          confidence: aiAnalysis.confidence,
        },
      });

      return {
        document,
        certification,
      };
    } catch (error) {
      await DocumentService.updateStatus(document.id, "failed");
      await AuditService.log({
        eventType: "certification.failed",
        companyId,
        documentId: document.id,
        userId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
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

    // Check confidence threshold
    if (aiAnalysis.confidence < policy.minConfidence) {
      return {
        certifiable: false,
        reason: `Confidence ${aiAnalysis.confidence} below threshold ${policy.minConfidence}`,
      };
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
