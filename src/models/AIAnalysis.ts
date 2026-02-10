import mongoose, { Schema, Document } from "mongoose";

export interface IAIAnalysis extends Document {
  documentId: string;
  companyId: number;
  aiVersion: string;
  documentFamily: string;
  subtype: string;
  confidence: number;
  extractedClaims: Record<string, unknown>;
  explainabilitySignals: {
    reasoning: string[];
    anomalies: string[];
    warnings: string[];
  };
  rawResponse: Record<string, unknown>;
  analyzedAt: Date;
  createdAt: Date;
}

const AIAnalysisSchema = new Schema<IAIAnalysis>(
  {
    documentId: { type: String, required: true, index: true },
    companyId: { type: Number, required: true, index: true },
    aiVersion: { type: String, required: true },
    documentFamily: { type: String, required: true },
    subtype: { type: String, required: true, default: "unknown" },
    confidence: { type: Number, required: true, default: 0, min: 0, max: 1 },
    extractedClaims: { type: Schema.Types.Mixed, default: {} },
    explainabilitySignals: {
      reasoning: { type: [String], default: [] },
      anomalies: { type: [String], default: [] },
      warnings: { type: [String], default: [] },
    },
    rawResponse: { type: Schema.Types.Mixed, required: true },
    analyzedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AIAnalysisSchema.index({ documentId: 1, createdAt: -1 });

export const AIAnalysis = mongoose.model<IAIAnalysis>("AIAnalysis", AIAnalysisSchema, "ai_analyses");
