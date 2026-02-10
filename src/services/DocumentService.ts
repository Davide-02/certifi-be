import mongoose, { Schema, Document as MongoDocument, Model } from "mongoose";
import { uploadFile } from "../utils/upload";
import { generateSHA256 } from "../utils/hash";
import { v4 as uuidv4 } from "uuid";

export interface IDocument extends MongoDocument {
  id: string;
  companyId: number;
  originalFileName: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadedBy: number;
  uploadedAt: Date;
  status: "pending" | "analyzing" | "analyzed" | "certified" | "rejected" | "failed";
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
    uploadedBy: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "analyzing", "analyzed", "certified", "rejected", "failed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for company isolation (includes fileHash index)
DocumentSchema.index({ companyId: 1, fileHash: 1 }, { unique: true });

export const DocumentModel = mongoose.model<IDocument>("Document", DocumentSchema, "documents");

export class DocumentService {
  static async storeDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    companyId: number,
    uploadedBy: number
  ): Promise<IDocument> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("File buffer is empty or invalid");
    }

    const fileHash = generateSHA256(fileBuffer);
    
    if (!fileHash || fileHash.length === 0) {
      throw new Error("Failed to generate file hash");
    }
    
    // Check if document with same hash already exists for this company
    const existing = await DocumentModel.findOne({ fileHash, companyId }).exec();
    if (existing) {
      console.log(`[DocumentService] Document with hash ${fileHash} already exists, returning existing document`);
      return existing;
    }

    const storageKey = await uploadFile(fileBuffer, fileName, mimeType);

    const document = new DocumentModel({
      id: uuidv4(),
      companyId,
      originalFileName: fileName,
      fileHash, // Ensure this is never null
      fileSize: fileBuffer.length,
      mimeType,
      storageKey,
      uploadedBy,
      uploadedAt: new Date(),
      status: "pending",
    });

    // Validate before saving
    if (!document.fileHash) {
      throw new Error("Document fileHash is null before save");
    }

    await document.save();
    return document;
  }

  static async getById(documentId: string, companyId: number): Promise<IDocument | null> {
    return DocumentModel.findOne({ id: documentId, companyId }).exec();
  }

  static async updateStatus(documentId: string, status: IDocument["status"]): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate({ id: documentId }, { status }, { new: true }).exec();
  }

  static async updateStatusWithCompanyCheck(
    documentId: string,
    companyId: number,
    status: IDocument["status"]
  ): Promise<IDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { id: documentId, companyId },
      { status },
      { new: true }
    ).exec();
  }
}
