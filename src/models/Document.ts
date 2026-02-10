import mongoose, { Schema, Document as MongoDocument, Model } from "mongoose";

export interface IDocument extends MongoDocument {
  id: string; // UUID or hash-based ID
  companyId: number; // Reference to Company
  originalFileName: string;
  fileHash: string; // SHA-256 hash of binary content
  fileSize: number;
  mimeType: string;
  storageKey: string; // S3/R2 key for secure storage
  uploadedBy: number; // User ID
  uploadedAt: Date;
  status: "pending" | "analyzing" | "analyzed" | "certified" | "rejected" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentModel extends Model<IDocument> {
  findByHash(hash: string, companyId: number): Promise<IDocument | null>;
}

const DocumentSchema = new Schema<IDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    companyId: {
      type: Number,
      required: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileHash: {
      type: String,
      required: true,
      // Index is created by compound index below
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: Number,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["pending", "analyzing", "analyzed", "certified", "rejected", "failed"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for company isolation
DocumentSchema.index({ companyId: 1, fileHash: 1 }, { unique: true });

DocumentSchema.statics.findByHash = async function (
  hash: string,
  companyId: number
): Promise<IDocument | null> {
  return this.findOne({ fileHash: hash, companyId }).exec();
};

// Note: DocumentModel is created in services/DocumentService.ts to avoid duplicate registration
// This file only exports the interface and schema structure
// Use DocumentService.DocumentModel or import from services/DocumentService.ts
