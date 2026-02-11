import mongoose, { Schema, Document as MongoDocument, Model, Types } from "mongoose";

export interface DocumentRole {
  roleType: "holder" | "issuer" | "verifier";
  entityType: "individual" | "organization";
  userId?: Types.ObjectId; // If entityType is "individual"
  organizationId?: number; // If entityType is "organization" (reference to Company)
  assignedAt: Date;
}

export interface IDocument extends MongoDocument {
  id: string; // UUID or hash-based ID
  companyId: number; // Reference to Company (tenant/issuer company)
  originalFileName: string;
  fileHash: string; // SHA-256 hash of binary content
  fileSize: number;
  mimeType: string;
  storageKey: string; // S3/R2 key for secure storage
  uploadedBy: Types.ObjectId; // User MongoDB ObjectId
  uploadedAt: Date;
  roles: DocumentRole[]; // Array of roles (holder, issuer, verifier) with references to users/companies
  status: "pending" | "analyzing" | "analyzed" | "certified" | "expired" | "rejected" | "failed";
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
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    roles: [
      {
        roleType: {
          type: String,
          enum: ["holder", "issuer", "verifier"],
          required: true,
        },
        entityType: {
          type: String,
          enum: ["individual", "organization"],
          required: true,
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: function (this: DocumentRole) {
            return this.entityType === "individual";
          },
        },
        organizationId: {
          type: Number,
          ref: "Company",
          required: function (this: DocumentRole) {
            return this.entityType === "organization";
          },
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "analyzing", "analyzed", "certified", "expired", "rejected", "failed"],
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
