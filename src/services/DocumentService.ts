import mongoose, { Schema, Document as MongoDocument, Model, Types } from "mongoose";
import { uploadFile } from "../utils/upload";
import { generateSHA256 } from "../utils/hash";
import { v4 as uuidv4 } from "uuid";

import { DocumentRole } from "../models/Document";

export interface CertificationData {
  blockchainTxHash: string;
  certificationPolicy: {
    documentFamily: string;
    confidence: number;
    policyVersion: string;
  };
  certifiedAt: Date;
  certifiedBy: Types.ObjectId;
  /** Valido fino a questa data; null = per sempre */
  validUntil?: Date | null;
}

export interface IDocument extends MongoDocument {
  id: string;
  companyId: number;
  originalFileName: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  roles: DocumentRole[];
  status: "pending" | "analyzing" | "analyzed" | "certified" | "expired" | "rejected" | "failed";
  certification?: CertificationData;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    id: { type: String, required: true, unique: true },
    companyId: { type: Number, required: true, index: true },
    originalFileName: { type: String, required: true },
    fileHash: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v: string) {
          return v != null && v.length > 0;
        },
        message: "fileHash cannot be null or empty"
      }
    },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true },
    uploadedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true,
    },
    uploadedAt: { type: Date, default: Date.now },
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
          required: function (this: any) {
            return this.entityType === "individual";
          },
        },
        organizationId: {
          type: Number,
          ref: "Company",
          required: function (this: any) {
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
    certification: {
      blockchainTxHash: { type: String, index: true },
      certificationPolicy: {
        documentFamily: String,
        confidence: Number,
        policyVersion: String,
      },
      certifiedAt: { type: Date, index: true },
      certifiedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
      validUntil: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

DocumentSchema.index({ fileHash: 1 });
// Compound index for company isolation (includes fileHash index)
DocumentSchema.index({ companyId: 1, fileHash: 1 }, { unique: true });

export const DocumentModel = mongoose.model<IDocument>("Document", DocumentSchema, "documents");

export class DocumentService {
  static async storeDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    uploadedBy: Types.ObjectId
  ): Promise<IDocument> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("File buffer is empty or invalid");
    }

    const fileHash = generateSHA256(fileBuffer);
    
    if (!fileHash || fileHash.length === 0) {
      throw new Error("Failed to generate file hash");
    }
    
    // Check if document with same hash already exists
    const existing = await DocumentModel.findOne({ fileHash }).exec();
    if (existing) {
      console.log(`[DocumentService] Document with hash ${fileHash} already exists, returning existing document`);
      return existing;
    }

    const storageKey = await uploadFile(fileBuffer, fileName, mimeType);

    const document = new DocumentModel({
      id: uuidv4(),
      companyId: 1,
      originalFileName: fileName,
      fileHash, // Ensure this is never null
      fileSize: fileBuffer.length,
      mimeType,
      storageKey,
      uploadedBy,
      uploadedAt: new Date(),
      roles: [], // Initialize empty roles array, will be populated during analysis/certification
      status: "pending",
    });

    // Validate before saving
    if (!document.fileHash) {
      throw new Error("Document fileHash is null before save");
    }

    await document.save();
    return document;
  }

  static async getById(documentId: string): Promise<IDocument | null> {
    return DocumentModel.findOne({ id: documentId }).exec();
  }

  static async updateStatus(documentId: string, status: IDocument["status"]): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate({ id: documentId }, { status }, { new: true }).exec();
  }

  static async setCertification(
    documentId: string,
    certification: CertificationData
  ): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { id: documentId },
      {
        status: "certified" as const,
        certification,
      },
      { new: true }
    ).exec();
  }

  static async findByFileHash(fileHash: string): Promise<IDocument | null> {
    const normalized = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;
    return DocumentModel.findOne({
      fileHash: { $in: [normalized, fileHash] },
    }).exec();
  }

  static async findCertifiedByFileHash(fileHash: string): Promise<IDocument | null> {
    const normalizedHash = fileHash.startsWith("0x") ? fileHash.slice(2) : fileHash;
    return DocumentModel.findOne({
      fileHash: normalizedHash,
      status: "certified",
    }).exec();
  }

  static async checkAndExpireDocuments(): Promise<number> {
    const now = new Date();
    const result = await DocumentModel.updateMany(
      {
        status: "certified",
        "certification.validUntil": { $ne: null, $lt: now },
      },
      { $set: { status: "expired" } }
    ).exec();
    return result.modifiedCount;
  }

  static async updateCertificationValidUntil(
    documentId: string,
    validUntil: Date | null
  ): Promise<IDocument | null> {
    const update: Record<string, unknown> = {
      "certification.validUntil": validUntil,
    };
    if (validUntil !== null && new Date(validUntil) > new Date()) {
      update.status = "certified";
    }
    return DocumentModel.findOneAndUpdate(
      { id: documentId, certification: { $exists: true, $ne: null } },
      { $set: update },
      { new: true }
    ).exec();
  }

  static async checkAndExpireDocument(documentId: string): Promise<IDocument | null> {
    const document = await DocumentModel.findOne({ id: documentId }).exec();
    if (
      document &&
      document.status === "certified" &&
      document.certification?.validUntil &&
      new Date(document.certification.validUntil) < new Date()
    ) {
      return DocumentModel.findOneAndUpdate(
        { id: documentId },
        { $set: { status: "expired" } },
        { new: true }
      ).exec();
    }
    return document;
  }
}
