import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  documentId: string | null;
  user_id: Types.ObjectId | null;
  action: "viewed" | "verified" | "updated" | string; // Allow other actions too
  timestamp: Date;
  notes?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    documentId: {
      type: String,
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
  },
  {
    timestamps: false, // We use custom timestamp field
  },
);

// Compound indexes for common queries
AuditLogSchema.index({ documentId: 1, timestamp: -1 });
AuditLogSchema.index({ user_id: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>(
  "AuditLog",
  AuditLogSchema,
  "audit_logs",
);
