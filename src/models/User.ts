import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  username: string;
  passwordHash: string;
  name: string;
  surname: string;
  role: "admin" | "issuer" | "holder" | "verifier";
  status: "active" | "inactive" | "suspended";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    surname: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "issuer", "holder", "verifier"],
      required: true,
      default: "verifier",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      required: true,
      default: "active",
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Aggiunge automaticamente createdAt e updatedAt
  }
);

export const User = mongoose.model<IUser>("User", UserSchema, "users");

