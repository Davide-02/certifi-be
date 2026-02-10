import mongoose, { Schema, Document } from "mongoose";

export interface ICertification extends Document {
  documentId: string;
  companyId: number;
  fileHash: string;
  blockchainTxHash: string;
  certificationPolicy: {
    documentFamily: string;
    confidence: number;
    policyVersion: string;
  };
  certifiedAt: Date;
  certifiedBy: number;
  createdAt: Date;
  updatedAt: Date;
}

const CertificationSchema = new Schema<ICertification>(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    companyId: { type: Number, required: true, index: true },
    fileHash: { type: String, required: true, unique: true, index: true },
    blockchainTxHash: { type: String, required: true, index: true },
    certificationPolicy: {
      documentFamily: { type: String, required: true },
      confidence: { type: Number, required: true },
      policyVersion: { type: String, required: true },
    },
    certifiedAt: { type: Date, default: Date.now, index: true },
    certifiedBy: { type: Number, required: true },
  },
  { timestamps: true }
);

CertificationSchema.index({ fileHash: 1 });

export const Certification = mongoose.model<ICertification>("Certification", CertificationSchema, "certifications");
