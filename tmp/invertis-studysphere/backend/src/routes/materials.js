import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { Material, Download, View, Bookmark, Report } from '../models/Material.js';
import { Subject, Semester, Branch, Category, Module } from '../models/Academic.js';
import { authenticate, optionalAuth, can } from '../middleware/auth.js';
import { ah, ApiError, audit, escapeRegex, isId, pageParams, sha256 } from '../utils/helpers.js';
import { validateUpload, IMAGE_EXTS, PREVIEWABLE_EXTS } from '../utils/fileTypes.js';
import { saveBuffer, openStream, removeFile } from '../utils/storage.js';
import { env } from '../config/env.js';
import { userCan } from '../utils/settings.js';
import { notify } from '../utils/notify.js';
import { sweepMaterials } from '../utils/jobs.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileMb * 1024 * 1024, files: 20 },
});

const POPULATE = [
  { path: 'subject', select: 'name code' },
  { path: 'module', select: 'name' },
  { path: 'category', select: 'name slug' },
  { path: 'semester', select: 'number name' },
  { path: 'branch', select: 'name' },
  { path: 'course', select: 'name' },
  { path: 'uploadedBy', select: 'name' },
];

const isLive = () => ({
  deletedAt: null,
  status: 'published',
  $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }],
});

const isFullAccess = (user) => user && ['super_admin', 'admin'].includes(user.role);

/** Editing rule: needs materials.edit; content managers may only touch their own uploads. */
async function canEditMaterial(user, material) {
  if (!(await userCan(user, 'materials.edit'))) return false;
  return isFullAccess(user) || String(material.uploadedBy?._id || material.uploadedBy) === String(user._id);
}

const tagList = (raw) =>
  (Array.isArray(raw) ? raw : String(raw || '').split(','))
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 15);

const metaSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  subject: z.string().refine(isId, 'Choose a subject'),
  module: z.string().optional().or(z.literal('')),
  category: z.string().refine(isId, 'Choose a category'),
  academicYear: z.string().trim().max(20).optional(),
  examType: z.enum(['', 'mid_sem', 'end_sem', 'supplementary', 'other']).optional(),
  tags: z.any().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishAt: z.string().optional().or(z.literal('')),
  allowDuplicate: z.any().optional(),
});

async function hierarchyFor(subjectId) {
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(400, 'Subject not found');
  const semester = await Semester.findById(subject.semester);
  const branch = semester && (await Branch.findById(semester.branch));
  return { subject: subject._id, semester: semester?._id, branch: branch?._id, course: branch?.course };
}

// ------------------------------------------------------------------ PUBLIC LISTING / SEARCH

router.get(
  '/',
  ah(async (req, res) => {
    const { q, sort = 'relevance' } = req.query;
    const { page, limit, skip } = pageParams(req.query, 12);
    const conds = [isLive()];
    for (const f of ['course', 'branch', 'semester', 'subject', 'module', 'category']) {
      if (req.query[f]) {
        if (!isId(String(req.query[f]))) throw new ApiError(400, `Invalid ${f}`);
        conds.push({ [f]: req.query[f] });
      }
    }
    if (req.query.academicYear) conds.push({ academicYear: String(req.query.academicYear) });
    if (req.query.examType) conds.push({ examType: String(req.query.examType) });
    if (req.query.tag) conds.push({ tags: String(req.query.tag).toLowerCase() });
    if (req.query.fileType) conds.push({ 'file.ext': `.${String(req.query.fileType).replace('.', '').toLowerCase()}` });
    if (req.query.featured === '1') conds.push({ featured: true });

    const term = q ? String(q).trim().slice(0, 100) : '';
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const [subjects, categories, modules] = await Promise.all([
        Subject.find({ $or: [{ name: rx }, { code: rx }] }).select('_id').limit(50),
        Category.find({ name: rx }).select('_id').limit(20),
        Module.find({ name: rx }).select('_id').limit(50),
      ]);
      conds.push({
        $or: [
          { title: rx },
          { description: rx },
          { tags: rx },
          { academicYear: rx },
          { subject: { $in: subjects.map((s) => s._id) } },
          { category: { $in: categories.map((c) => c._id) } },
          { module: { $in: modules.map((m) => m._id) } },
        ],
      });
    }
    const filter = { $and: conds };

    const sortMap = { newest: { createdAt: -1 }, downloads: { downloads: -1, createdAt: -1 }, views: { views: -1, createdAt: -1 } };

    // Relevance: score in memory over the (capped) candidate set, then paginate
    if (term && sort === 'relevance') {
      const candidates = await Material.find(filter).sort({ createdAt: -1 }).limit(300).populate(POPULATE);
      const t = term.toLowerCase();
      const words = t.split(/\s+/).filter(Boolean);
      const score = (m) => {
        const title = m.title.toLowerCase();
        let s = 0;
        if (title === t) s += 10;
        if (title.startsWith(t)) s += 5;
        if (title.includes(t)) s += 4;
        for (const w of words) {
          if (title.includes(w)) s += 2;
          if (m.tags.some((x) => x.includes(w))) s += 1.5;
          if (m.subject?.name?.toLowerCase().includes(w)) s += 1;
        }
        return s + Math.log10(1 + m.downloads) * 0.3;
      };
      const ranked = candidates.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s).map((x) => x.m);
      return res.json({ items: ranked.slice(skip, skip + limit), total: ranked.length, page, pages: Math.ceil(ranked.length / limit) || 1 });
    }

    const [items, total] = await Promise.all([
      Material.find(filter).sort(sortMap[sort] || sortMap.newest).skip(skip).limit(limit).populate(POPULATE),
      Material.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

router.get(
  '/suggest',
  ah(async (req, res) => {
    const term = String(req.query.q || '').trim().slice(0, 60);
    if (term.length < 2) return res.json({ items: [] });
    const rx = new RegExp(escapeRegex(term), 'i');
    const items = await Material.find({ $and: [isLive(), { title: rx }] })
      .sort({ downloads: -1 })
      .limit(6)
      .select('title');
    res.json({ items: items.map((m) => ({ _id: m._id, title: m.title })) });
  })
);

// ------------------------------------------------------------------ STAFF MANAGEMENT LIST

router.get(
  '/manage/list',
  authenticate,
  ah(async (req, res) => {
    const user = req.user;
    const isStaff = (await userCan(user, 'materials.upload')) || (await userCan(user, 'materials.edit'));
    if (!isStaff) throw new ApiError(403, 'You do not have permission to manage materials');
    const { page, limit, skip } = pageParams(req.query, 15);
    const filter = {};
    if (req.query.trash === '1') filter.deletedAt = { $ne: null };
    else filter.deletedAt = null;
    if (req.query.status && ['draft', 'pending', 'published', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    for (const f of ['subject', 'category', 'semester']) if (isId(String(req.query[f] || ''))) filter[f] = req.query[f];
    if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    if (!isFullAccess(user)) filter.uploadedBy = user._id; // content managers see only their own
    const [items, total] = await Promise.all([
      Material.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
      Material.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// ------------------------------------------------------------------ UPLOAD (single, multiple, bulk)

router.post(
  '/',
  authenticate,
  can('materials.upload'),
  upload.array('files', 20),
  ah(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw new ApiError(400, 'Choose at least one file');
    const meta = metaSchema.parse(req.body);
    const h = await hierarchyFor(meta.subject);
    if (!(await Category.exists({ _id: meta.category }))) throw new ApiError(400, 'Category not found');
    if (meta.module && !(await Module.exists({ _id: meta.module, subject: meta.subject }))) throw new ApiError(400, 'Module does not belong to this subject');

    const canApprove = await userCan(req.user, 'materials.approve');
    const requested = meta.status === 'draft' ? 'draft' : 'published';
    const status = requested === 'published' && !canApprove ? 'pending' : requested;
    const publishAt = meta.publishAt ? new Date(meta.publishAt) : undefined;
    if (publishAt && Number.isNaN(publishAt.getTime())) throw new ApiError(400, 'Invalid publish date');

    const created = [];
    const skipped = [];
    for (const f of files) {
      let info;
      try {
        info = validateUpload(f);
      } catch (msg) {
        skipped.push({ name: f.originalname, reason: String(msg) });
        continue;
      }
      const hash = sha256(f.buffer);
      if (!meta.allowDuplicate) {
        const dup = await Material.findOne({ 'file.hash': hash, deletedAt: null }).select('title');
        if (dup) {
          skipped.push({ name: f.originalname, reason: `Duplicate of existing material "${dup.title}"`, duplicate: true });
          continue;
        }
      }
      const stored = await saveBuffer(f.buffer, info.ext);
      const baseName = path.basename(f.originalname, path.extname(f.originalname));
      const doc = await Material.create({
        title: files.length === 1 && meta.title ? meta.title : meta.title && files.length > 1 ? `${meta.title} - ${baseName}` : baseName,
        description: meta.description || '',
        ...h,
        module: meta.module || undefined,
        category: meta.category,
        academicYear: meta.academicYear || undefined,
        examType: meta.examType || '',
        tags: tagList(meta.tags),
        uploadedBy: req.user._id,
        status,
        publishAt,
        file: { ...stored, originalName: f.originalname, mimeType: info.mime, ext: info.ext, size: f.size, hash },
      });
      created.push(doc);
      await audit(req, 'material.upload', 'Material', doc._id, { title: doc.title, status });
    }
    if (!created.length) throw new ApiError(400, skipped[0]?.reason || 'No files were uploaded', skipped);
    if (status === 'published') sweepMaterials().catch(() => {});
    res.status(201).json({ items: created, skipped, message: status === 'pending' ? 'Uploaded and sent for approval' : 'Uploaded' });
  })
);

// ------------------------------------------------------------------ BULK ACTIONS

router.post(
  '/bulk',
  authenticate,
  ah(async (req, res) => {
    const { action, ids, category } = z
      .object({
        action: z.enum(['delete', 'restore', 'categorize', 'publish', 'unpublish']),
        ids: z.array(z.string().refine(isId)).min(1).max(200),
        category: z.string().optional(),
      })
      .parse(req.body);
    const need = { delete: 'materials.delete', restore: 'materials.delete', categorize: 'materials.edit', publish: 'materials.approve', unpublish: 'materials.approve' }[action];
    if (!(await userCan(req.user, need))) throw new ApiError(403, 'You do not have permission for this bulk action');

    const filter = { _id: { $in: ids } };
    if (!isFullAccess(req.user)) filter.uploadedBy = req.user._id;
    let update;
    if (action === 'delete') update = { deletedAt: new Date(), deletedBy: req.user._id };
    else if (action === 'restore') update = { deletedAt: null, deletedBy: null };
    else if (action === 'publish') update = { status: 'published', rejectionReason: undefined };
    else if (action === 'unpublish') update = { status: 'draft' };
    else {
      if (!category || !isId(category) || !(await Category.exists({ _id: category }))) throw new ApiError(400, 'Choose a valid category');
      update = { category };
    }
    const r = await Material.updateMany(filter, update);
    await audit(req, `material.bulk.${action}`, 'Material', null, { count: r.modifiedCount, ids });
    res.json({ message: `${r.modifiedCount} material(s) updated`, modified: r.modifiedCount });
  })
);

// ------------------------------------------------------------------ SINGLE MATERIAL

async function loadForViewer(req) {
  const material = await Material.findById(req.params.id).populate(POPULATE);
  if (!material) throw new ApiError(404, 'Material not found');
  const live = !material.deletedAt && material.status === 'published' && (!material.publishAt || material.publishAt <= new Date());
  if (!live) {
    const staff = req.user && ((await canEditMaterial(req.user, material)) || (await userCan(req.user, 'materials.approve')));
    if (!staff) throw new ApiError(404, 'Material not found');
  }
  return material;
}

router.get(
  '/:id',
  optionalAuth,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const material = await loadForViewer(req);
    let bookmarked = false;
    if (req.user) bookmarked = Boolean(await Bookmark.exists({ user: req.user._id, material: material._id }));
    const canEdit = req.user ? await canEditMaterial(req.user, material) : false;
    const previewable = PREVIEWABLE_EXTS.includes(material.file.ext);
    res.json({ material, bookmarked, canEdit, previewable });
  })
);

router.get(
  '/:id/related',
  ah(async (req, res) => {
    if (!isId(req.params.id)) return res.json({ items: [] });
    const m = await Material.findById(req.params.id).select('subject');
    if (!m) return res.json({ items: [] });
    const items = await Material.find({ $and: [isLive(), { subject: m.subject, _id: { $ne: m._id } }] })
      .sort({ downloads: -1 })
      .limit(4)
      .populate(POPULATE);
    res.json({ items });
  })
);

// Count a view (called once per page open by the frontend)
router.post(
  '/:id/view',
  optionalAuth,
  ah(async (req, res) => {
    if (!isId(req.params.id)) return res.json({ ok: false });
    const m = await Material.findOne({ _id: req.params.id, ...isLive() }).select('_id');
    if (m) {
      await Promise.all([View.create({ material: m._id, user: req.user?._id }), Material.updateOne({ _id: m._id }, { $inc: { views: 1 } })]);
    }
    res.json({ ok: true });
  })
);

// Public thumbnail for image materials only
router.get(
  '/:id/thumbnail',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    const m = await Material.findOne({ _id: req.params.id, ...isLive() });
    if (!m || !IMAGE_EXTS.includes(m.file.ext)) throw new ApiError(404, 'No thumbnail');
    res.setHeader('Content-Type', m.file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    (await openStream(m.file)).pipe(res);
  })
);

async function streamFile(res, material, disposition) {
  const f = material.file;
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(f.originalName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  const stream = await openStream(f);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

// Inline preview (PDF / images / video). Login required. Not counted as a download.
router.get(
  '/:id/preview',
  authenticate,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const material = await loadForViewer(req);
    if (!PREVIEWABLE_EXTS.includes(material.file.ext)) throw new ApiError(400, 'Preview is not available for this file type');
    await streamFile(res, material, 'inline');
  })
);

// Protected download. Login required; every download is recorded.
router.get(
  '/:id/download',
  authenticate,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const material = await loadForViewer(req);
    await Promise.all([Download.create({ user: req.user._id, material: material._id }), Material.updateOne({ _id: material._id }, { $inc: { downloads: 1 } })]);
    await streamFile(res, material, 'attachment');
  })
);

// Bookmark toggle
router.post(
  '/:id/bookmark',
  authenticate,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const existing = await Bookmark.findOneAndDelete({ user: req.user._id, material: req.params.id });
    if (existing) return res.json({ bookmarked: false });
    const m = await Material.findOne({ _id: req.params.id, ...isLive() }).select('_id');
    if (!m) throw new ApiError(404, 'Material not found');
    await Bookmark.create({ user: req.user._id, material: m._id });
    res.json({ bookmarked: true });
  })
);

// Report a material
router.post(
  '/:id/report',
  authenticate,
  ah(async (req, res) => {
    const data = z
      .object({ reason: z.string().trim().min(3, 'Choose a reason').max(100), details: z.string().trim().max(1000).optional() })
      .parse(req.body);
    const m = await Material.findOne({ _id: req.params.id, ...isLive() }).select('_id');
    if (!m) throw new ApiError(404, 'Material not found');
    if (await Report.exists({ material: m._id, user: req.user._id, status: 'open' })) throw new ApiError(409, 'You have already reported this material');
    await Report.create({ material: m._id, user: req.user._id, ...data });
    res.status(201).json({ message: 'Thanks, the administrators will review this material.' });
  })
);

// ------------------------------------------------------------------ EDIT / REPLACE / DELETE / APPROVE

router.patch(
  '/:id',
  authenticate,
  ah(async (req, res) => {
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    if (!(await canEditMaterial(req.user, material))) throw new ApiError(403, 'You cannot edit this material');
    const data = z
      .object({
        title: z.string().trim().min(2).max(200).optional(),
        description: z.string().trim().max(2000).optional(),
        subject: z.string().refine(isId).optional(),
        module: z.string().optional().or(z.literal('')),
        category: z.string().refine(isId).optional(),
        academicYear: z.string().trim().max(20).optional(),
        examType: z.enum(['', 'mid_sem', 'end_sem', 'supplementary', 'other']).optional(),
        tags: z.any().optional(),
        status: z.enum(['draft', 'published']).optional(),
        publishAt: z.string().optional().or(z.literal('')).or(z.null()),
        featured: z.boolean().optional(),
      })
      .parse(req.body);

    if (data.subject && data.subject !== String(material.subject)) Object.assign(material, await hierarchyFor(data.subject));
    if (data.module !== undefined) material.module = data.module || undefined;
    for (const k of ['title', 'description', 'category', 'academicYear', 'examType']) if (data[k] !== undefined) material[k] = data[k];
    if (data.tags !== undefined) material.tags = tagList(data.tags);
    if (data.publishAt !== undefined) material.publishAt = data.publishAt ? new Date(data.publishAt) : undefined;
    const canApprove = await userCan(req.user, 'materials.approve');
    if (data.status) material.status = data.status === 'published' && !canApprove ? 'pending' : data.status;
    if (data.featured !== undefined) {
      if (!canApprove) throw new ApiError(403, 'Only approvers can feature materials');
      material.featured = data.featured;
    }
    await material.save();
    await audit(req, 'material.update', 'Material', material._id, { fields: Object.keys(data) });
    res.json(await material.populate(POPULATE));
  })
);

// Replace the file; the previous file is kept in version history
router.put(
  '/:id/file',
  authenticate,
  upload.single('file'),
  ah(async (req, res) => {
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    if (!(await canEditMaterial(req.user, material))) throw new ApiError(403, 'You cannot edit this material');
    if (!req.file) throw new ApiError(400, 'Choose a replacement file');
    let info;
    try {
      info = validateUpload(req.file);
    } catch (m) {
      throw new ApiError(400, String(m));
    }
    const hash = sha256(req.file.buffer);
    if (hash === material.file.hash) throw new ApiError(409, 'This file is identical to the current version');
    const stored = await saveBuffer(req.file.buffer, info.ext);
    material.versions.push({ file: material.file.toObject(), replacedBy: req.user._id, note: String(req.body.note || '').slice(0, 200) });
    material.file = { ...stored, originalName: req.file.originalname, mimeType: info.mime, ext: info.ext, size: req.file.size, hash };
    if (!(await userCan(req.user, 'materials.approve')) && material.status === 'published') material.status = 'pending';
    await material.save();
    await audit(req, 'material.replaceFile', 'Material', material._id, { version: material.versions.length });
    res.json(await material.populate(POPULATE));
  })
);

// Soft delete -> recycle bin
router.delete(
  '/:id',
  authenticate,
  can('materials.delete'),
  ah(async (req, res) => {
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    if (!isFullAccess(req.user) && String(material.uploadedBy) !== String(req.user._id)) throw new ApiError(403, 'You cannot delete this material');
    material.deletedAt = new Date();
    material.deletedBy = req.user._id;
    await material.save();
    await audit(req, 'material.delete', 'Material', material._id, { title: material.title });
    res.json({ message: 'Moved to recycle bin' });
  })
);

router.post(
  '/:id/restore',
  authenticate,
  can('materials.delete'),
  ah(async (req, res) => {
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    if (!isFullAccess(req.user) && String(material.uploadedBy) !== String(req.user._id)) throw new ApiError(403, 'You cannot restore this material');
    material.deletedAt = null;
    material.deletedBy = undefined;
    await material.save();
    await audit(req, 'material.restore', 'Material', material._id);
    res.json({ message: 'Restored' });
  })
);

router.delete(
  '/:id/permanent',
  authenticate,
  can('materials.delete'),
  ah(async (req, res) => {
    if (!isFullAccess(req.user)) throw new ApiError(403, 'Only administrators can permanently delete');
    const material = await Material.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
    if (!material) throw new ApiError(404, 'Material not found in the recycle bin');
    await removeFile(material.file);
    for (const v of material.versions) await removeFile(v.file);
    await Promise.all([
      Bookmark.deleteMany({ material: material._id }),
      Report.deleteMany({ material: material._id }),
      material.deleteOne(),
    ]);
    await audit(req, 'material.permanentDelete', 'Material', material._id, { title: material.title });
    res.json({ message: 'Permanently deleted' });
  })
);

router.post(
  '/:id/approve',
  authenticate,
  can('materials.approve'),
  ah(async (req, res) => {
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    material.status = 'published';
    material.rejectionReason = undefined;
    await material.save();
    await audit(req, 'material.approve', 'Material', material._id, { title: material.title });
    notify([material.uploadedBy], { type: 'approval', title: `Approved: ${material.title}`, body: 'Your material is now published.', link: `/materials/${material._id}` });
    sweepMaterials().catch(() => {});
    res.json({ message: 'Approved and published' });
  })
);

router.post(
  '/:id/reject',
  authenticate,
  can('materials.approve'),
  ah(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body);
    const material = await Material.findById(req.params.id);
    if (!material) throw new ApiError(404, 'Material not found');
    material.status = 'rejected';
    material.rejectionReason = reason;
    await material.save();
    await audit(req, 'material.reject', 'Material', material._id, { reason });
    notify([material.uploadedBy], { type: 'approval', title: `Rejected: ${material.title}`, body: reason || 'Please review and upload again.', link: '/admin/materials' });
    res.json({ message: 'Rejected' });
  })
);

export default router;
