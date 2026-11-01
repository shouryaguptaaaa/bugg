import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Material, Download, View, Report } from '../models/Material.js';
import { Subject } from '../models/Academic.js';
import { Announcement, FAQ, ContactMessage, AuditLog, PlatformSettings } from '../models/Platform.js';
import { authenticate, can, requireRole } from '../middleware/auth.js';
import { ah, ApiError, audit, escapeRegex, isId, pageParams } from '../utils/helpers.js';
import { getSettings, invalidateSettings } from '../utils/settings.js';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from '../config/permissions.js';
import { env } from '../config/env.js';
import { storageDriver } from '../utils/storage.js';
import { notify } from '../utils/notify.js';

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------- STATS & ANALYTICS

function rangeFrom(query) {
  let to = query.to ? new Date(query.to) : new Date();
  let from;
  if (query.from) from = new Date(query.from);
  else from = new Date(Date.now() - (Math.min(365, Math.max(1, parseInt(query.days, 10) || 30))) * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ApiError(400, 'Invalid date range');
  if (query.to) to = new Date(to.getTime() + 86400000 - 1); // include the whole end day
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function fillDays(rows, from, to, key = 'count') {
  const map = new Map(rows.map((r) => [r._id, r[key]]));
  const out = [];
  for (let d = new Date(from); d <= to && out.length < 400; d = new Date(d.getTime() + 86400000)) {
    const k = d.toISOString().slice(0, 10);
    out.push({ date: k, value: map.get(k) || 0 });
  }
  return out;
}

const dayGroup = (field = '$createdAt') => ({ $dateToString: { format: '%Y-%m-%d', date: field } });

router.get(
  '/stats',
  can('analytics.view'),
  ah(async (req, res) => {
    const [students, materials, pending, subjects, openReports] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Material.countDocuments({ deletedAt: null }),
      Material.countDocuments({ deletedAt: null, status: 'pending' }),
      Subject.countDocuments(),
      Report.countDocuments({ status: 'open' }),
    ]);
    const [dl, vw, storage, popularSubjects, recentUploads, recentActivities, byType] = await Promise.all([
      Download.countDocuments(),
      View.countDocuments(),
      Material.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: null, bytes: { $sum: '$file.size' } } }]),
      Material.aggregate([
        { $match: { deletedAt: null, status: 'published' } },
        { $group: { _id: '$subject', materials: { $sum: 1 }, downloads: { $sum: '$downloads' }, views: { $sum: '$views' } } },
        { $sort: { downloads: -1, materials: -1 } },
        { $limit: 6 },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 's' } },
        { $unwind: '$s' },
        { $project: { name: '$s.name', materials: 1, downloads: 1, views: 1 } },
      ]),
      Material.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(6).populate('subject', 'name').populate('uploadedBy', 'name'),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name role'),
      Material.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$file.ext', count: { $sum: 1 }, bytes: { $sum: '$file.size' } } }, { $sort: { bytes: -1 } }]),
    ]);
    res.json({
      totals: { students, materials, downloads: dl, views: vw, pendingApprovals: pending, subjects, openReports, storageBytes: storage[0]?.bytes || 0 },
      popularSubjects,
      recentUploads,
      recentActivities,
      storageByType: byType.map((t) => ({ ext: t._id, count: t.count, bytes: t.bytes })),
      storageDriver,
    });
  })
);

router.get(
  '/analytics',
  can('analytics.view'),
  ah(async (req, res) => {
    const { from, to } = rangeFrom(req.query);
    const range = { createdAt: { $gte: from, $lte: to } };
    const [dailyDownloads, activeStudents, registrations, topViewed, topDownloaded, popularSubjects, monthlyUploads, storageMonthly] = await Promise.all([
      Download.aggregate([{ $match: range }, { $group: { _id: dayGroup(), count: { $sum: 1 } } }]),
      // Active students per day = distinct users who viewed or downloaded something
      View.aggregate([
        { $match: { ...range, user: { $ne: null } } },
        { $group: { _id: { d: dayGroup(), u: '$user' } } },
        { $group: { _id: '$_id.d', count: { $sum: 1 } } },
      ]),
      User.aggregate([{ $match: { ...range, role: 'student' } }, { $group: { _id: dayGroup(), count: { $sum: 1 } } }]),
      View.aggregate([
        { $match: range },
        { $group: { _id: '$material', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
        { $unwind: '$m' },
        { $project: { title: '$m.title', count: 1 } },
      ]),
      Download.aggregate([
        { $match: range },
        { $group: { _id: '$material', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
        { $unwind: '$m' },
        { $project: { title: '$m.title', count: 1 } },
      ]),
      Download.aggregate([
        { $match: range },
        { $lookup: { from: 'materials', localField: 'material', foreignField: '_id', as: 'm' } },
        { $unwind: '$m' },
        { $group: { _id: '$m.subject', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 's' } },
        { $unwind: '$s' },
        { $project: { name: '$s.name', count: 1 } },
      ]),
      Material.aggregate([{ $match: { ...range, deletedAt: null } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Material.aggregate([{ $match: { ...range, deletedAt: null } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, bytes: { $sum: '$file.size' } } }, { $sort: { _id: 1 } }]),
    ]);
    res.json({
      range: { from, to },
      dailyDownloads: fillDays(dailyDownloads, from, to),
      activeStudents: fillDays(activeStudents, from, to),
      registrations: fillDays(registrations, from, to),
      topViewed,
      topDownloaded,
      popularSubjects,
      monthlyUploads: monthlyUploads.map((r) => ({ month: r._id, count: r.count })),
      storageMonthly: storageMonthly.map((r) => ({ month: r._id, mb: Math.round((r.bytes / 1048576) * 100) / 100 })),
    });
  })
);

router.get(
  '/health',
  can('analytics.view'),
  ah(async (_req, res) => {
    res.json({
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      storageDriver,
      emailConfigured: env.emailEnabled,
      environment: env.isProd ? 'production' : 'development',
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    });
  })
);

// ---------------------------------------------------------------- USERS

const ADMIN_ROLES = ['super_admin', 'admin'];

router.get(
  '/users',
  can('users.manage'),
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 15);
    const filter = {};
    if (req.query.group === 'staff') filter.role = { $in: ['super_admin', 'admin', 'content_manager'] };
    else if (req.query.group === 'students') filter.role = 'student';
    if (req.query.status === 'active' || req.query.status === 'suspended') filter.status = req.query.status;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { enrollmentNo: rx }];
    }
    const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

const passwordRule = z.string().min(8).max(100).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain letters and numbers');

router.post(
  '/users',
  can('users.manage'),
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().toLowerCase().email(),
        password: passwordRule,
        role: z.enum(ROLES),
        enrollmentNo: z.string().trim().max(40).optional(),
      })
      .parse(req.body);
    // Only a Super Admin may create admin-level accounts
    if (ADMIN_ROLES.includes(data.role) && req.user.role !== 'super_admin') throw new ApiError(403, 'Only a Super Admin can create administrators');
    const user = await User.create({ ...data, passwordHash: await bcrypt.hash(data.password, 12), emailVerified: true });
    await audit(req, 'user.create', 'User', user._id, { email: user.email, role: user.role });
    res.status(201).json(user);
  })
);

router.patch(
  '/users/:id',
  can('users.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'User not found');
    const data = z
      .object({
        name: z.string().trim().min(2).max(100).optional(),
        enrollmentNo: z.string().trim().max(40).optional(),
        role: z.enum(ROLES).optional(),
        status: z.enum(['active', 'suspended']).optional(),
      })
      .parse(req.body);
    const target = await User.findById(req.params.id);
    if (!target) throw new ApiError(404, 'User not found');
    const isSelf = String(target._id) === String(req.user._id);
    const actorIsSuper = req.user.role === 'super_admin';
    if (isSelf && (data.role || data.status)) throw new ApiError(400, 'You cannot change your own role or status');
    if (ADMIN_ROLES.includes(target.role) && !actorIsSuper) throw new ApiError(403, 'Only a Super Admin can modify administrators');
    if (data.role && ADMIN_ROLES.includes(data.role) && !actorIsSuper) throw new ApiError(403, 'Only a Super Admin can assign administrator roles');
    if (target.role === 'super_admin' && (data.role || data.status)) {
      const others = await User.countDocuments({ role: 'super_admin', status: 'active', _id: { $ne: target._id } });
      if (!others) throw new ApiError(400, 'There must always be at least one active Super Admin');
    }
    const before = { status: target.status, role: target.role };
    Object.assign(target, data);
    await target.save();
    await audit(req, 'user.update', 'User', target._id, data);
    if (data.status && data.status !== before.status) notify([target._id], { type: 'account', title: data.status === 'suspended' ? 'Your account has been suspended' : 'Your account has been reactivated', body: 'Contact the administrators if you have questions.' });
    if (data.role && data.role !== before.role) notify([target._id], { type: 'account', title: 'Your role was updated', body: `You are now: ${data.role.replace('_', ' ')}`, link: '/dashboard' });
    res.json(target);
  })
);

// ---------------------------------------------------------------- ROLE PERMISSIONS (Super Admin only)

router.get(
  '/permissions',
  requireRole('super_admin'),
  ah(async (_req, res) => {
    const s = await getSettings(true);
    res.json({ catalogue: PERMISSIONS, roles: s.rolePermissions || DEFAULT_ROLE_PERMISSIONS, defaults: DEFAULT_ROLE_PERMISSIONS });
  })
);

router.put(
  '/permissions/:role',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const role = req.params.role;
    if (!['admin', 'content_manager', 'student'].includes(role)) throw new ApiError(400, 'This role cannot be edited');
    const { permissions } = z.object({ permissions: z.array(z.enum(Object.keys(PERMISSIONS))) }).parse(req.body);
    const s = await getSettings(true);
    const map = { ...DEFAULT_ROLE_PERMISSIONS, ...(s.rolePermissions || {}), [role]: permissions };
    s.rolePermissions = map;
    s.markModified('rolePermissions');
    await s.save();
    invalidateSettings();
    await audit(req, 'permissions.update', 'Role', role, { permissions });
    res.json({ roles: map });
  })
);

// ---------------------------------------------------------------- SETTINGS / BRANDING

router.get('/settings', can('settings.manage'), ah(async (_req, res) => res.json(await getSettings(true))));

router.put(
  '/settings',
  can('settings.manage'),
  ah(async (req, res) => {
    const t = (n) => z.string().trim().max(n).optional();
    const data = z
      .object({
        siteName: t(100),
        tagline: t(200),
        contactEmail: t(120),
        contactPhone: t(40),
        contactAddress: t(300),
        footerCredit: t(200),
        allowRegistration: z.boolean().optional(),
        company: z
          .object({
            name: t(100),
            tagline: t(200),
            kind: t(200),
            description: t(1500),
            founder: t(100),
            founderTitle: t(150),
            website: t(200),
            email: t(120),
            phone: t(40),
            logoUrl: t(500),
            portfolio: z.array(z.object({ name: t(100), description: t(300), url: t(200) })).max(12).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    const s = await getSettings(true);
    const { company, ...rest } = data;
    Object.assign(s, rest);
    if (company) {
      for (const [k, v] of Object.entries(company)) s.company[k] = v;
      s.markModified('company');
    }
    await s.save();
    invalidateSettings();
    await audit(req, 'settings.update', 'PlatformSettings', s._id);
    res.json(s);
  })
);

// ---------------------------------------------------------------- AUDIT LOGS

router.get(
  '/audit-logs',
  can('audit.view'),
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 25, 100);
    const filter = {};
    if (req.query.action) filter.action = new RegExp(`^${escapeRegex(String(req.query.action).slice(0, 40))}`);
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name role'),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// ---------------------------------------------------------------- COMMUNICATION

function crud(path, Model, schema, sort, onCreate) {
  router.get(path, can('communication.manage'), ah(async (_req, res) => res.json({ items: await Model.find().sort(sort) })));
  router.post(
    path,
    can('communication.manage'),
    ah(async (req, res) => {
      const doc = await Model.create({ ...schema.parse(req.body), createdBy: req.user._id });
      await audit(req, `${Model.modelName.toLowerCase()}.create`, Model.modelName, doc._id);
      onCreate?.(doc);
      res.status(201).json(doc);
    })
  );
  router.patch(
    `${path}/:id`,
    can('communication.manage'),
    ah(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new ApiError(404, 'Not found');
      Object.assign(doc, schema.partial().parse(req.body));
      await doc.save();
      await audit(req, `${Model.modelName.toLowerCase()}.update`, Model.modelName, doc._id);
      res.json(doc);
    })
  );
  router.delete(
    `${path}/:id`,
    can('communication.manage'),
    ah(async (req, res) => {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) throw new ApiError(404, 'Not found');
      await audit(req, `${Model.modelName.toLowerCase()}.delete`, Model.modelName, doc._id);
      res.json({ message: 'Deleted' });
    })
  );
}

crud(
  '/announcements',
  Announcement,
  z.object({ title: z.string().trim().min(2).max(200), body: z.string().trim().min(2).max(3000), priority: z.enum(['normal', 'important']).optional(), published: z.boolean().optional() }),
  { createdAt: -1 },
  (a) => a.published && notify({ role: 'student' }, { type: 'announcement', title: a.title, body: a.body.slice(0, 200), link: '/dashboard' })
);
crud(
  '/faqs',
  FAQ,
  z.object({ question: z.string().trim().min(3).max(300), answer: z.string().trim().min(2).max(3000), order: z.coerce.number().int().optional(), published: z.boolean().optional() }),
  { order: 1, createdAt: 1 }
);

router.get(
  '/contact-messages',
  can('communication.manage'),
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 20);
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const [items, total] = await Promise.all([ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), ContactMessage.countDocuments(filter)]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);
router.patch(
  '/contact-messages/:id',
  can('communication.manage'),
  ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['new', 'read', 'resolved']) }).parse(req.body);
    const doc = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) throw new ApiError(404, 'Not found');
    res.json(doc);
  })
);
router.delete(
  '/contact-messages/:id',
  can('communication.manage'),
  ah(async (req, res) => {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  })
);

// ---------------------------------------------------------------- REPORTS

router.get(
  '/reports',
  can('reports.manage'),
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 20);
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const [items, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email').populate('material', 'title status deletedAt'),
      Report.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);
router.patch(
  '/reports/:id',
  can('reports.manage'),
  ah(async (req, res) => {
    const { status } = z.object({ status: z.enum(['open', 'resolved', 'dismissed']) }).parse(req.body);
    const doc = await Report.findByIdAndUpdate(req.params.id, { status, resolvedBy: req.user._id }, { new: true });
    if (!doc) throw new ApiError(404, 'Not found');
    await audit(req, 'report.update', 'Report', doc._id, { status });
    res.json(doc);
  })
);

// ---------------------------------------------------------------- BACKUP (Super Admin)
// Streams a JSON snapshot of every collection (password hashes and one-time tokens are excluded).
// Uploaded files live in Cloudinary / the upload directory and must be backed up separately (see docs/DEPLOYMENT.md).

const SECRET_FIELDS = { passwordHash: 0, verifyTokenHash: 0, resetTokenHash: 0, resetExpires: 0, avatarKey: 0 };

router.get(
  '/backup',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const db = mongoose.connection.db;
    const names = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="studysphere-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.write(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"collections":{`);
    for (let i = 0; i < names.length; i++) {
      res.write(`${i ? ',' : ''}${JSON.stringify(names[i])}:[`);
      let first = true;
      for await (const doc of db.collection(names[i]).find({}, { projection: names[i] === 'users' ? SECRET_FIELDS : {} })) {
        res.write(`${first ? '' : ','}${JSON.stringify(doc)}`);
        first = false;
      }
      res.write(']');
    }
    res.end('}}');
    await audit(req, 'backup.export', 'Database', undefined, { collections: names.length });
  })
);

export default router;
