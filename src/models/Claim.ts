import mongoose, { Schema, Document, Types } from "mongoose";

export interface IClaim extends Document {
  documentId: string; // Reference to Document
  companyId: number; // Tenant isolation
  claimType: string; // e.g., "service_agreement", "identity", "certification"
  serviceType?: string;
  amount?: number;
  currency?: string;
  subject?: string;
  entity?: string; // Company or entity name
  startDate?: Date;
  endDate?: Date;
  status?: "active" | "expired" | "revoked" | "fulfilled";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimSchema = new Schema<IClaim>(
  {
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: Number,
      required: true,
      index: true,
    },
    claimType: {
      type: String,
      required: true,
      index: true,
    },
    serviceType: { type: String, trim: true },
    amount: { type: Number },
    currency: { type: String, trim: true },
    subject: { type: String, trim: true },
    entity: { type: String, trim: true },
    startDate: { type: Date, index: true },
    endDate: { type: Date, index: true },
    status: {
      type: String,
      enum: ["active", "expired", "revoked", "fulfilled"],
      default: "active",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound indexes for common queries
ClaimSchema.index({ documentId: 1, companyId: 1 });
ClaimSchema.index({ companyId: 1, claimType: 1 });
ClaimSchema.index({ companyId: 1, status: 1 });
ClaimSchema.index({ documentId: 1, createdAt: -1 });

export const Claim = mongoose.model<IClaim>("Claim", ClaimSchema, "claims");
