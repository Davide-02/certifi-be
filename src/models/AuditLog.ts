import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  documentId: string | null;
  claimId?: Types.ObjectId | null; // Reference to Claim if action involves a claim
  user_id: Types.ObjectId | null;
  action: "viewed" | "verified" | "updated" | "uploaded" | "analyzed" | "certified" | "rejected" | "failed" | "claim_created" | "claim_updated" | "claim_revoked" | string;
  timestamp: Date;
  notes?: string;
  result?: "success" | "failure" | "pending"; // Result of the action
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    documentId: {
      type: String,
      index: true,
      default: null,
    },
    claimId: {
      type: Schema.Types.ObjectId,
      ref: "Claim",
      index: true,
      default: null,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        "viewed",
        "verified",
        "updated",
        "uploaded",
        "analyzed",
        "certified",
        "rejected",
        "failed",
        "claim_created",
        "claim_updated",
        "claim_revoked",
      ],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      default: "",
    },
    result: {
      type: String,
      enum: ["success", "failure", "pending"],
      index: true,
    },
  },
  {
    timestamps: false, // We use custom timestamp field
  },
);

// Compound indexes for common queries
AuditLogSchema.index({ documentId: 1, timestamp: -1 });
AuditLogSchema.index({ claimId: 1, timestamp: -1 });
AuditLogSchema.index({ user_id: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, result: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>(
  "AuditLog",
  AuditLogSchema,
  "audit_logs",
);
