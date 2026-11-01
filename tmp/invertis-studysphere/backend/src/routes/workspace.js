import { Router } from 'express';
import { z } from 'zod';
import { PersonalNote, StudyPlan, Folder, ReadingProgress, SearchHistory } from '../models/Personal.js';
import { Material } from '../models/Material.js';
import { Subject } from '../models/Academic.js';
import { authenticate } from '../middleware/auth.js';
import { ah, ApiError, isId } from '../utils/helpers.js';

// Student personal workspace: notes, folders, study planner & to-dos, reading progress, search history.
// Every query is scoped to req.user._id, so students can only ever touch their own records.
const router = Router();
router.use(authenticate);

const SUBJ = { path: 'subject', select: 'name code' };
const MAT = { path: 'materials', select: 'title file.ext file.size subject status deletedAt', populate: { path: 'subject', select: 'name' } };
const optId = z.string().refine(isId).optional().or(z.literal(''));
const checkSubject = async (id) => {
  if (id && !(await Subject.exists({ _id: id }))) throw new ApiError(400, 'Subject not found');
};
const own = (Model, req) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
  return Model.findOne({ _id: req.params.id, user: req.user._id });
};

// ------------------------------------------------------------------ NOTES

const noteSchema = z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(20000).optional(), subject: optId, pinned: z.boolean().optional() });

router.get(
  '/notes',
  ah(async (req, res) => {
    const filter = { user: req.user._id };
    if (isId(String(req.query.subject))) filter.subject = req.query.subject;
    if (req.query.q) filter.$or = [{ title: new RegExp(String(req.query.q).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
    res.json({ items: await PersonalNote.find(filter).sort({ pinned: -1, updatedAt: -1 }).limit(200).populate(SUBJ) });
  })
);
router.post(
  '/notes',
  ah(async (req, res) => {
    const d = noteSchema.parse(req.body);
    await checkSubject(d.subject);
    const n = await PersonalNote.create({ ...d, subject: d.subject || undefined, user: req.user._id });
    res.status(201).json(await n.populate(SUBJ));
  })
);
router.patch(
  '/notes/:id',
  ah(async (req, res) => {
    const n = await own(PersonalNote, req);
    if (!n) throw new ApiError(404, 'Note not found');
    const d = noteSchema.partial().parse(req.body);
    if (d.subject !== undefined) {
      await checkSubject(d.subject);
      n.subject = d.subject || undefined;
    }
    for (const k of ['title', 'body', 'pinned']) if (d[k] !== undefined) n[k] = d[k];
    await n.save();
    res.json(await n.populate(SUBJ));
  })
);
router.delete(
  '/notes/:id',
  ah(async (req, res) => {
    const n = await own(PersonalNote, req);
    if (!n) throw new ApiError(404, 'Note not found');
    await n.deleteOne();
    res.json({ message: 'Deleted' });
  })
);

// ------------------------------------------------------------------ FOLDERS / COLLECTIONS

router.get('/folders', ah(async (req, res) => res.json({ items: await Folder.find({ user: req.user._id }).sort({ name: 1 }).populate(MAT) })));
router.post(
  '/folders',
  ah(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    try {
      res.status(201).json(await Folder.create({ user: req.user._id, name }));
    } catch (e) {
      if (e.code === 11000) throw new ApiError(409, 'You already have a folder with this name');
      throw e;
    }
  })
);
router.patch(
  '/folders/:id',
  ah(async (req, res) => {
    const f = await own(Folder, req);
    if (!f) throw new ApiError(404, 'Folder not found');
    f.name = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body).name;
    try {
      await f.save();
    } catch (e) {
      if (e.code === 11000) throw new ApiError(409, 'You already have a folder with this name');
      throw e;
    }
    res.json(f);
  })
);
router.delete(
  '/folders/:id',
  ah(async (req, res) => {
    const f = await own(Folder, req);
    if (!f) throw new ApiError(404, 'Folder not found');
    await f.deleteOne();
    res.json({ message: 'Deleted' });
  })
);
router.post(
  '/folders/:id/materials',
  ah(async (req, res) => {
    const f = await own(Folder, req);
    if (!f) throw new ApiError(404, 'Folder not found');
    const { material } = z.object({ material: z.string().refine(isId) }).parse(req.body);
    if (!(await Material.exists({ _id: material, deletedAt: null, status: 'published' }))) throw new ApiError(404, 'Material not found');
    if (!f.materials.some((m) => String(m) === material)) f.materials.push(material);
    await f.save();
    res.json({ message: `Saved to "${f.name}"` });
  })
);
router.delete(
  '/folders/:id/materials/:mid',
  ah(async (req, res) => {
    const f = await own(Folder, req);
    if (!f) throw new ApiError(404, 'Folder not found');
    f.materials = f.materials.filter((m) => String(m) !== req.params.mid);
    await f.save();
    res.json({ message: 'Removed' });
  })
);

// ------------------------------------------------------------------ STUDY PLANNER + TO-DO

const planSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['study', 'goal', 'exam', 'assignment', 'todo']).optional(),
  subject: optId,
  date: z.string().optional().or(z.literal('')).or(z.null()),
  durationMin: z.coerce.number().int().min(0).max(1440).optional(),
  notes: z.string().trim().max(1000).optional(),
  reminderAt: z.string().optional().or(z.literal('')).or(z.null()),
  done: z.boolean().optional(),
});
const toDate = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid date');
  return d;
};

router.get(
  '/plans',
  ah(async (req, res) => {
    const filter = { user: req.user._id };
    if (req.query.kind) filter.kind = String(req.query.kind);
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = toDate(req.query.from);
      if (req.query.to) filter.date.$lte = toDate(req.query.to);
    }
    res.json({ items: await StudyPlan.find(filter).sort({ date: 1, createdAt: 1 }).limit(500).populate(SUBJ) });
  })
);
router.get(
  '/plans/summary',
  ah(async (req, res) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    const week = await StudyPlan.find({ user: req.user._id, date: { $gte: weekStart, $lt: weekEnd }, kind: { $ne: 'todo' } });
    const todos = await StudyPlan.find({ user: req.user._id, kind: 'todo' });
    const upcoming = await StudyPlan.find({ user: req.user._id, done: false, kind: { $in: ['exam', 'assignment'] }, date: { $gte: now } }).sort({ date: 1 }).limit(5).populate(SUBJ);
    res.json({
      weekTotal: week.length,
      weekDone: week.filter((p) => p.done).length,
      weekMinutes: week.filter((p) => p.done).reduce((s, p) => s + (p.durationMin || 0), 0),
      todoOpen: todos.filter((t) => !t.done).length,
      todoDone: todos.filter((t) => t.done).length,
      upcoming,
    });
  })
);
router.post(
  '/plans',
  ah(async (req, res) => {
    const d = planSchema.parse(req.body);
    await checkSubject(d.subject);
    const kind = d.kind || 'study';
    if (kind !== 'todo' && !d.date) throw new ApiError(400, 'Choose a date');
    const p = await StudyPlan.create({ ...d, kind, subject: d.subject || undefined, date: toDate(d.date), reminderAt: toDate(d.reminderAt), user: req.user._id });
    res.status(201).json(await p.populate(SUBJ));
  })
);
router.patch(
  '/plans/:id',
  ah(async (req, res) => {
    const p = await own(StudyPlan, req);
    if (!p) throw new ApiError(404, 'Plan not found');
    const d = planSchema.partial().parse(req.body);
    if (d.subject !== undefined) {
      await checkSubject(d.subject);
      p.subject = d.subject || undefined;
    }
    for (const k of ['title', 'kind', 'durationMin', 'notes']) if (d[k] !== undefined) p[k] = d[k];
    if (d.date !== undefined) p.date = toDate(d.date);
    if (d.reminderAt !== undefined) {
      p.reminderAt = toDate(d.reminderAt);
      p.reminderSent = false;
    }
    if (d.done !== undefined) {
      p.done = d.done;
      p.doneAt = d.done ? new Date() : undefined;
    }
    await p.save();
    res.json(await p.populate(SUBJ));
  })
);
router.delete(
  '/plans/:id',
  ah(async (req, res) => {
    const p = await own(StudyPlan, req);
    if (!p) throw new ApiError(404, 'Plan not found');
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  })
);

// ------------------------------------------------------------------ READING PROGRESS

router.get(
  '/progress',
  ah(async (req, res) => {
    const rows = await ReadingProgress.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(30).populate({ path: 'material', select: 'title file.ext subject deletedAt status', populate: { path: 'subject', select: 'name' } });
    const items = rows.filter((r) => r.material && !r.material.deletedAt && r.material.status === 'published').map((r) => ({ _id: r._id, percent: r.percent, updatedAt: r.updatedAt, material: r.material }));
    res.json({ items, completed: items.filter((i) => i.percent >= 100).length, inProgress: items.filter((i) => i.percent < 100).length });
  })
);
router.get(
  '/progress/:materialId',
  ah(async (req, res) => {
    if (!isId(req.params.materialId)) throw new ApiError(404, 'Not found');
    const p = await ReadingProgress.findOne({ user: req.user._id, material: req.params.materialId });
    res.json({ percent: p?.percent || 0 });
  })
);
router.put(
  '/progress/:materialId',
  ah(async (req, res) => {
    if (!isId(req.params.materialId)) throw new ApiError(404, 'Not found');
    const { percent } = z.object({ percent: z.coerce.number().min(0).max(100) }).parse(req.body);
    if (!(await Material.exists({ _id: req.params.materialId, deletedAt: null, status: 'published' }))) throw new ApiError(404, 'Material not found');
    const p = await ReadingProgress.findOneAndUpdate({ user: req.user._id, material: req.params.materialId }, { percent }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ percent: p.percent });
  })
);

// ------------------------------------------------------------------ SEARCH HISTORY

router.get('/searches', ah(async (req, res) => res.json({ items: await SearchHistory.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(20) })));
router.post(
  '/searches',
  ah(async (req, res) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(req.body);
    await SearchHistory.findOneAndUpdate({ user: req.user._id, q: q.toLowerCase() }, { $set: { updatedAt: new Date() } }, { upsert: true });
    const keep = await SearchHistory.find({ user: req.user._id }).sort({ updatedAt: -1 }).skip(30).select('_id'); // cap history at 30
    if (keep.length) await SearchHistory.deleteMany({ _id: { $in: keep.map((k) => k._id) } });
    res.status(201).json({ message: 'Saved' });
  })
);
router.delete('/searches', ah(async (req, res) => { await SearchHistory.deleteMany({ user: req.user._id }); res.json({ message: 'Search history cleared' }); }));
router.delete(
  '/searches/:id',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    await SearchHistory.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Removed' });
  })
);

export default router;
