import { AIAnalysis } from "../models/AIAnalysis";
import { AIService } from "./AIService";
import { DocumentService, IDocument } from "./DocumentService";
import { AuditService } from "./AuditService";
import { AIAnalysisResponse } from "../dto/ai.dto";
import { User } from "../models/User";
import { Types } from "mongoose";

/**
 * Service for document analysis (without certification)
 * Analyzes document with AI but does NOT send to blockchain
 */
export class AnalysisService {
  /**
   * Get User MongoDB ObjectId from numeric ID
   */
  private static async getUserObjectId(userId: number): Promise<Types.ObjectId | null> {
    try {
      const user = await User.findOne({ id: userId }).exec();
      return user ? user._id : null;
    } catch {
      return null;
    }
  }
  /**
   * Analyze document flow:
   * 1. Store document
   * 2. Send to AI for analysis
   * 3. Store AI output (versioned)
   * 4. Return analysis results (NO blockchain interaction)
   */
  static async analyzeDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    companyId: number,
    userId: number,
    requestedTasks?: string[]
  ): Promise<{
    document: IDocument;
    aiAnalysis: AIAnalysisResponse;
  }> {
    // 1. Store document securely
    const document = await DocumentService.storeDocument(
      fileBuffer,
      fileName,
      mimeType,
      companyId,
      userId
    );

    await AuditService.log({
      action: "uploaded",
      documentId: document.id,
      user_id: userId ? await this.getUserObjectId(userId) : null,
      notes: `File uploaded: ${fileName} (${fileBuffer.length} bytes), hash: ${document.fileHash}`,
    });

    // 2. Update status to analyzing
    await DocumentService.updateStatus(document.id, "analyzing");

    // 3. Send to AI service for analysis
    let aiAnalysisResponse: AIAnalysisResponse;
    try {
      aiAnalysisResponse = await AIService.analyzeDocument(
        document.id,
        document.fileHash,
        fileBuffer,
        fileName,
        mimeType,
        requestedTasks
      );

      // Log AI response for debugging
      console.log("[AnalysisService] AI Response received:", JSON.stringify(aiAnalysisResponse, null, 2));

      // Validate required fields from AI response
      if (!aiAnalysisResponse.document_family) {
        throw new Error("AI response missing required field: document_family");
      }

      // Extract fields with fallbacks
      const documentFamily = aiAnalysisResponse.document_family;
      const subtype = aiAnalysisResponse.document_type || aiAnalysisResponse.subtype || "unknown";
      const confidence = typeof aiAnalysisResponse.confidence === "number" 
        ? aiAnalysisResponse.confidence 
        : (aiAnalysisResponse.compliance_score ?? 0);

      console.log(`[AnalysisService] Extracted: family=${documentFamily}, subtype=${subtype}, confidence=${confidence}, compliance_score=${aiAnalysisResponse.compliance_score}`);

      // Extract claims (can be in claims or extracted_claims)
      const extractedClaims = aiAnalysisResponse.claims || aiAnalysisResponse.extracted_claims || {};
      
      // Store all AI response data in rawResponse for complete record

      // 4. Store AI analysis (versioned)
      const aiAnalysis = new AIAnalysis({
        documentId: document.id,
        companyId,
        aiVersion: process.env.AI_VERSION || "v1.0",
        documentFamily,
        subtype,
        confidence,
        extractedClaims,
        explainabilitySignals: {
          reasoning: aiAnalysisResponse.explainability?.reasoning || [],
          anomalies: aiAnalysisResponse.anomalies?.map(String) || aiAnalysisResponse.explainability?.anomalies || [],
          warnings: aiAnalysisResponse.explainability?.warnings || [],
        },
        rawResponse: aiAnalysisResponse,
        analyzedAt: new Date(),
      });

      await aiAnalysis.save();

      await DocumentService.updateStatus(document.id, "analyzed");

      await AuditService.log({
        action: "analyzed",
        documentId: document.id,
        user_id: userId ? await this.getUserObjectId(userId) : null,
        notes: `AI analysis completed: ${aiAnalysisResponse.document_family}/${subtype}, confidence: ${confidence}`,
      });

      return {
        document,
        aiAnalysis: aiAnalysisResponse,
      };
    } catch (error) {
      await DocumentService.updateStatus(document.id, "failed");
      await AuditService.log({
        action: "failed",
        documentId: document.id,
        user_id: userId ? await this.getUserObjectId(userId) : null,
        notes: `AI analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      throw error;
    }
  }
}
