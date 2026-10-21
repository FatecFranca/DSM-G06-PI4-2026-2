import mongoose from 'mongoose';
import {
  ALL_USER_ROLES,
  ALL_USER_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from '../auth/constants.js';

const residentProfileSchema = new mongoose.Schema(
  {
    householdSize: { type: Number, min: 1 },
    neighborhood: { type: String, trim: true },
    foodPreferences: { type: String, trim: true },
    communityNeeds: { type: String, trim: true },
  },
  { _id: false },
);

const collaboratorProfileSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true },
    department: { type: String, trim: true },
    startDate: { type: Date },
    skills: [{ type: String, trim: true }],
    availability: { type: String, trim: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2 },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    emergencyContact: { type: String, required: true, trim: true },
    roles: {
      type: [{ type: String, enum: ALL_USER_ROLES }],
      required: true,
      default: [USER_ROLES.RESIDENT],
      validate: {
        validator: (roles) => roles.length > 0 && new Set(roles).size === roles.length,
        message: 'O usuário deve ter pelo menos um papel sem duplicidades.',
      },
    },
    status: {
      type: String,
      enum: ALL_USER_STATUSES,
      default: USER_STATUSES.PENDING,
      index: true,
    },
    residentProfile: { type: residentProfileSchema },
    collaboratorProfile: { type: collaboratorProfileSchema },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    phone: this.phone,
    birthDate: this.birthDate,
    address: this.address,
    emergencyContact: this.emergencyContact,
    roles: this.roles,
    status: this.status,
    residentProfile: this.residentProfile,
    collaboratorProfile: this.collaboratorProfile,
    approvedAt: this.approvedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);
