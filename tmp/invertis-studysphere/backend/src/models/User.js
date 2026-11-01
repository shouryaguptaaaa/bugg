import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    enrollmentNo: { type: String, trim: true, maxlength: 40 },
    course: { type: Schema.Types.ObjectId, ref: 'Course' },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch' },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester' },
    avatarUrl: { type: String },
    avatarKey: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
    lastLoginAt: { type: Date },
    notifyPrefs: {
      material: { type: Boolean, default: true },
      announcement: { type: Boolean, default: true },
      quiz: { type: Boolean, default: true },
      assignment: { type: Boolean, default: true },
      approval: { type: Boolean, default: true },
      account: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text', enrollmentNo: 'text' });

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.verifyTokenHash;
    delete ret.resetTokenHash;
    delete ret.resetExpires;
    delete ret.avatarKey;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
