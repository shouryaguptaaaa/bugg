import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { User } from '../models/User.js';
import { authenticate, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { ah, ApiError, audit, randomToken, sha256 } from '../utils/helpers.js';
import { env } from '../config/env.js';
import { sendMail } from '../utils/mailer.js';
import { saveBuffer, removeFile } from '../utils/storage.js';
import { validateUpload } from '../utils/fileTypes.js';
import { getSettings, getRolePermissions } from '../utils/settings.js';
import { STAFF_ROLES } from '../config/permissions.js';

const router = Router();
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain letters and numbers');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password,
  enrollmentNo: z.string().trim().max(40).optional(),
});

const clientBase = () => env.clientUrls[0];

async function sessionPayload(user) {
  const permissions = await getRolePermissions(user.role);
  return { user: user.toJSON(), permissions, isStaff: STAFF_ROLES.includes(user.role) };
}

router.post(
  '/register',
  ah(async (req, res) => {
    const settings = await getSettings();
    if (!settings.allowRegistration) throw new ApiError(403, 'Registration is currently closed');
    const data = registerSchema.parse(req.body);
    if (await User.exists({ email: data.email })) throw new ApiError(409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verifyToken = randomToken();
    // Role is ALWAYS student here - administrators can never self-register.
    const user = await User.create({
      name: data.name,
      email: data.email,
      enrollmentNo: data.enrollmentNo,
      passwordHash,
      role: 'student',
      emailVerified: !env.emailEnabled,
      verifyTokenHash: env.emailEnabled ? sha256(verifyToken) : undefined,
    });

    if (env.emailEnabled) {
      const link = `${clientBase()}/verify-email?token=${verifyToken}`;
      await sendMail({
        to: user.email,
        subject: 'Verify your Invertis StudySphere account',
        text: `Hi ${user.name},\n\nPlease verify your email by opening this link:\n${link}\n\nIf you did not create this account, ignore this email.`,
      });
      return res.status(201).json({ message: 'Account created. Check your email to verify your account before signing in.', needsVerification: true });
    }
    setAuthCookie(res, user._id);
    res.status(201).json({ message: 'Account created', ...(await sessionPayload(user)) });
  })
);

async function doLogin(req, res, { staffOnly }) {
  const { email, password: pw } = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })
    .parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(pw, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Incorrect email or password');
  if (user.status !== 'active') throw new ApiError(403, 'This account has been suspended. Contact the administrators.');
  if (staffOnly && !STAFF_ROLES.includes(user.role)) throw new ApiError(403, 'This sign-in is for administrators only');
  if (!user.emailVerified) throw new ApiError(403, 'Please verify your email before signing in');
  user.lastLoginAt = new Date();
  await user.save();
  setAuthCookie(res, user._id);
  req.user = user;
  if (STAFF_ROLES.includes(user.role)) await audit(req, 'auth.login', 'User', user._id);
  res.json(await sessionPayload(user));
}

router.post('/login', ah((req, res) => doLogin(req, res, { staffOnly: false })));
router.post('/admin-login', ah((req, res) => doLogin(req, res, { staffOnly: true })));

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out' });
});

router.get(
  '/me',
  authenticate,
  ah(async (req, res) => res.json(await sessionPayload(req.user)))
);

router.get(
  '/verify-email',
  ah(async (req, res) => {
    const token = String(req.query.token || '');
    if (!token) throw new ApiError(400, 'Missing token');
    const user = await User.findOne({ verifyTokenHash: sha256(token) }).select('+verifyTokenHash');
    if (!user) throw new ApiError(400, 'This verification link is invalid or already used');
    user.emailVerified = true;
    user.verifyTokenHash = undefined;
    await user.save();
    res.json({ message: 'Email verified. You can now sign in.' });
  })
);

router.post(
  '/forgot-password',
  ah(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await User.findOne({ email });
    if (user && user.status === 'active') {
      const token = randomToken();
      user.resetTokenHash = sha256(token);
      user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const link = `${clientBase()}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your Invertis StudySphere password',
        text: `Hi ${user.name},\n\nUse this link within 1 hour to set a new password:\n${link}\n\nIf you did not request this, ignore this email.`,
      });
    }
    // Same response either way so emails cannot be enumerated
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  })
);

router.post(
  '/reset-password',
  ah(async (req, res) => {
    const { token, password: pw } = z.object({ token: z.string().min(10), password }).parse(req.body);
    const user = await User.findOne({ resetTokenHash: sha256(token), resetExpires: { $gt: new Date() } }).select(
      '+resetTokenHash +resetExpires'
    );
    if (!user) throw new ApiError(400, 'This reset link is invalid or has expired');
    user.passwordHash = await bcrypt.hash(pw, 12);
    user.passwordChangedAt = new Date();
    user.resetTokenHash = undefined;
    user.resetExpires = undefined;
    await user.save();
    res.json({ message: 'Password updated. You can now sign in.' });
  })
);

router.post(
  '/change-password',
  authenticate,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: password })
      .parse(req.body);
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();
    setAuthCookie(res, user._id); // keep this session alive, invalidate all others
    res.json({ message: 'Password changed. Other sessions have been signed out.' });
  })
);

router.patch(
  '/profile',
  authenticate,
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100).optional(),
        enrollmentNo: z.string().trim().max(40).optional(),
      })
      .parse(req.body);
    Object.assign(req.user, data);
    await req.user.save();
    res.json(await sessionPayload(req.user));
  })
);

router.post(
  '/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  ah(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Choose an image to upload');
    try {
      validateUpload(req.file, ['.jpg', '.jpeg', '.png']);
    } catch (m) {
      throw new ApiError(400, String(m));
    }
    const user = await User.findById(req.user._id).select('+avatarKey');
    const stored = await saveBuffer(req.file.buffer, req.file.originalname.toLowerCase().endsWith('png') ? '.png' : '.jpg', 'avatars');
    if (user.avatarKey) await removeFile({ storage: stored.storage, key: user.avatarKey });
    user.avatarKey = stored.key;
    user.avatarUrl = `/api/auth/avatar/${user._id}?v=${Date.now()}`;
    await user.save();
    res.json(await sessionPayload(user));
  })
);

router.get(
  '/avatar/:id',
  ah(async (req, res) => {
    const user = await User.findById(req.params.id).select('+avatarKey');
    if (!user?.avatarKey) throw new ApiError(404, 'No avatar');
    const { openStream } = await import('../utils/storage.js');
    const storage = env.cloudinaryEnabled ? 'cloudinary' : 'local';
    let file = { storage, key: user.avatarKey };
    if (storage === 'cloudinary') {
      const { v2 } = await import('cloudinary');
      file.url = v2.url(user.avatarKey, { resource_type: 'raw', secure: true });
    }
    res.setHeader('Content-Type', user.avatarKey.endsWith('.png') ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    (await openStream(file)).pipe(res);
  })
);

export default router;
