import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  id: number;
  name: string;
  slug: string;
  organizationType?: "certifier" | "client" | "supplier" | "government" | "other";
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  contacts?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  settings: {
    certificationPolicy: {
      minConfidence: number;
      allowedDocumentFamilies: string[];
      requireManualReview: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    id: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    organizationType: {
      type: String,
      enum: ["certifier", "client", "supplier", "government", "other"],
      index: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    contacts: {
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      website: { type: String, trim: true },
    },
    settings: {
      certificationPolicy: {
        minConfidence: { type: Number, default: 0.8, min: 0, max: 1 },
        allowedDocumentFamilies: { type: [String], default: [] },
        requireManualReview: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

CompanySchema.statics.getNextId = async function (): Promise<number> {
  const lastCompany = await this.findOne().sort({ id: -1 }).exec();
  return lastCompany?.id ? lastCompany.id + 1 : 1;
};

CompanySchema.pre("save", async function (next) {
  if (!this.id) {
    const CompanyModel = this.constructor as any;
    this.id = await CompanyModel.getNextId();
  }
  next();
});

export const Company = mongoose.model<ICompany>("Company", CompanySchema, "companies");
