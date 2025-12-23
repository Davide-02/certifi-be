import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  id: number; // ID sequenziale numerico (1, 2, 3, ...)
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

export interface IUserModel extends Model<IUser> {
  getNextId(): Promise<number>;
}

const UserSchema = new Schema<IUser>(
  {
    id: {
      type: Number,
      unique: true,
      sparse: true, // Permette valori null durante la creazione
    },
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

// Funzione per generare il prossimo ID sequenziale
UserSchema.statics.getNextId = async function (): Promise<number> {
  const lastUser = await this.findOne().sort({ id: -1 }).exec();
  if (!lastUser || !lastUser.id) {
    return 1;
  }
  return lastUser.id + 1;
};

// Pre-save hook per assegnare automaticamente l'ID se non presente
UserSchema.pre("save", async function (next) {
  if (!this.id) {
    const UserModel = this.constructor as IUserModel;
    this.id = await UserModel.getNextId();
  }
  next();
});

export const User = mongoose.model<IUser, IUserModel>(
  "User",
  UserSchema,
  "users"
);
