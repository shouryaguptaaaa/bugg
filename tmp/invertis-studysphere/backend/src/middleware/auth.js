import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError, ah } from '../utils/helpers.js';
import { userCan } from '../utils/settings.js';

export const COOKIE_NAME = 'ss_token';

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    path: '/',
  });
}

async function resolveUser(req) {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE_NAME] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub).select('+passwordChangedAt');
  if (!user || user.status !== 'active') return null;
  // Tokens issued before the last password change are no longer valid
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return user;
}

export const optionalAuth = ah(async (req, _res, next) => {
  req.user = await resolveUser(req);
  next();
});

export const authenticate = ah(async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw new ApiError(401, 'Please sign in to continue');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have access to this resource'));
  next();
};

/** Permission based guard. Must run after `authenticate`. */
export const can = (permission) =>
  ah(async (req, _res, next) => {
    if (!(await userCan(req.user, permission))) throw new ApiError(403, 'You do not have permission to do this');
    next();
  });
