import crypto from 'crypto';
import mongoose from 'mongoose';
import { AuditLog } from '../models/Platform.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sha256 = (bufferOrString) => crypto.createHash('sha256').update(bufferOrString).digest('hex');

export const randomToken = () => crypto.randomBytes(32).toString('hex');

export async function audit(req, action, entity, entityId, meta) {
  try {
    await AuditLog.create({
      user: req.user?._id,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      meta,
      ip: req.ip,
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

export function pageParams(query, defaultLimit = 12, maxLimit = 50) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
