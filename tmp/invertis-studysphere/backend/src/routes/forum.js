import { Router } from 'express';
import { z } from 'zod';
import { Discussion, Reply } from '../models/Community.js';
import { Subject } from '../models/Academic.js';
import { authenticate, can } from '../middleware/auth.js';
import { ah, ApiError, audit, escapeRegex, isId, pageParams } from '../utils/helpers.js';
import { userCan } from '../utils/settings.js';

const router = Router();
router.use(authenticate);

const AUTHOR = { path: 'author', select: 'name role avatarUrl' };
const SUBJ = { path: 'subject', select: 'name code' };
const isMod = (user) => userCan(user, 'forum.moderate');

const shapeReply = (r, uid) => ({
  _id: r._id,
  body: r.body,
  author: r.author,
  helpful: r.helpful,
  hidden: r.hidden,
  likeCount: r.likes.length,
  liked: r.likes.some((x) => String(x) === String(uid)),
  createdAt: r.createdAt,
});

// ------------------------------------------------------------------ LIST / SEARCH

router.get(
  '/',
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 15);
    const mod = await isMod(req.user);
    const filter = mod && req.query.hidden === '1' ? {} : { hidden: false };
    if (req.query.subject && isId(String(req.query.subject))) filter.subject = req.query.subject;
    if (req.query.resolved === '1') filter.resolved = true;
    if (req.query.resolved === '0') filter.resolved = false;
    if (req.query.mine === '1') filter.author = req.user._id; // discussion history
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
      filter.$or = [{ title: rx }, { body: rx }];
    }
    const [items, total] = await Promise.all([
      Discussion.find(filter).select('-reports').sort({ lastActivityAt: -1 }).skip(skip).limit(limit).populate([AUTHOR, SUBJ]),
      Discussion.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// Replies I wrote (history)
router.get(
  '/mine/replies',
  ah(async (req, res) => {
    const items = await Reply.find({ author: req.user._id, hidden: false }).sort({ createdAt: -1 }).limit(50).populate({ path: 'discussion', select: 'title hidden' });
    res.json({ items: items.filter((r) => r.discussion && !r.discussion.hidden).map((r) => ({ _id: r._id, body: r.body, createdAt: r.createdAt, discussion: r.discussion })) });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const data = z
      .object({ title: z.string().trim().min(5).max(200), body: z.string().trim().min(10).max(5000), subject: z.string().refine(isId).optional().or(z.literal('')) })
      .parse(req.body);
    if (data.subject && !(await Subject.exists({ _id: data.subject }))) throw new ApiError(400, 'Subject not found');
    const d = await Discussion.create({ title: data.title, body: data.body, subject: data.subject || undefined, author: req.user._id });
    res.status(201).json(await d.populate([AUTHOR, SUBJ]));
  })
);

// ------------------------------------------------------------------ MODERATION (before /:id)

router.get(
  '/moderation/queue',
  can('forum.moderate'),
  ah(async (_req, res) => {
    const [discussions, replies] = await Promise.all([
      Discussion.find({ $or: [{ 'reports.0': { $exists: true } }, { hidden: true }] }).sort({ updatedAt: -1 }).limit(100).populate(AUTHOR),
      Reply.find({ $or: [{ 'reports.0': { $exists: true } }, { hidden: true }] }).sort({ updatedAt: -1 }).limit(100).populate([AUTHOR, { path: 'discussion', select: 'title' }]),
    ]);
    res.json({ discussions, replies });
  })
);

router.patch(
  '/moderation/:kind/:id',
  can('forum.moderate'),
  ah(async (req, res) => {
    const Model = req.params.kind === 'discussion' ? Discussion : req.params.kind === 'reply' ? Reply : null;
    if (!Model || !isId(req.params.id)) throw new ApiError(404, 'Not found');
    const { action } = z.object({ action: z.enum(['hide', 'unhide', 'dismiss']) }).parse(req.body);
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Not found');
    if (action === 'hide') doc.hidden = true;
    if (action === 'unhide') doc.hidden = false;
    if (action === 'dismiss') doc.reports = [];
    await doc.save();
    await audit(req, `forum.${action}`, Model.modelName, doc._id);
    res.json({ message: 'Done' });
  })
);

// ------------------------------------------------------------------ THREAD

router.get(
  '/:id',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Discussion not found');
    const mod = await isMod(req.user);
    const d = await Discussion.findById(req.params.id).select('-reports').populate([AUTHOR, SUBJ]);
    if (!d || (d.hidden && !mod && String(d.author._id) !== String(req.user._id))) throw new ApiError(404, 'Discussion not found');
    const replies = await Reply.find({ discussion: d._id, ...(mod ? {} : { hidden: false }) }).sort({ helpful: -1, createdAt: 1 }).populate(AUTHOR);
    res.json({ discussion: d, replies: replies.map((r) => shapeReply(r, req.user._id)), canModerate: mod });
  })
);

router.post(
  '/:id/replies',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Discussion not found');
    const d = await Discussion.findOne({ _id: req.params.id, hidden: false });
    if (!d) throw new ApiError(404, 'Discussion not found');
    const { body } = z.object({ body: z.string().trim().min(2).max(3000) }).parse(req.body);
    const r = await Reply.create({ discussion: d._id, author: req.user._id, body });
    d.replyCount += 1;
    d.lastActivityAt = new Date();
    await d.save();
    res.status(201).json(shapeReply(await r.populate(AUTHOR), req.user._id));
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Discussion not found');
    const d = await Discussion.findById(req.params.id);
    if (!d) throw new ApiError(404, 'Discussion not found');
    const mod = await isMod(req.user);
    if (!mod && String(d.author) !== String(req.user._id)) throw new ApiError(403, 'You can only delete your own discussions');
    await Promise.all([Reply.deleteMany({ discussion: d._id }), d.deleteOne()]);
    if (mod) await audit(req, 'forum.delete', 'Discussion', d._id, { title: d.title });
    res.json({ message: 'Discussion deleted' });
  })
);

router.delete(
  '/replies/:rid',
  ah(async (req, res) => {
    if (!isId(req.params.rid)) throw new ApiError(404, 'Reply not found');
    const r = await Reply.findById(req.params.rid);
    if (!r) throw new ApiError(404, 'Reply not found');
    const mod = await isMod(req.user);
    if (!mod && String(r.author) !== String(req.user._id)) throw new ApiError(403, 'You can only delete your own replies');
    await r.deleteOne();
    await Discussion.updateOne({ _id: r.discussion }, { $inc: { replyCount: -1 } });
    res.json({ message: 'Reply deleted' });
  })
);

router.post(
  '/replies/:rid/like',
  ah(async (req, res) => {
    if (!isId(req.params.rid)) throw new ApiError(404, 'Reply not found');
    const r = await Reply.findOne({ _id: req.params.rid, hidden: false });
    if (!r) throw new ApiError(404, 'Reply not found');
    const has = r.likes.some((x) => String(x) === String(req.user._id));
    r.likes = has ? r.likes.filter((x) => String(x) !== String(req.user._id)) : [...r.likes, req.user._id];
    await r.save();
    res.json({ liked: !has, likeCount: r.likes.length });
  })
);

// Mark a helpful answer: the question's author or a moderator
router.post(
  '/replies/:rid/helpful',
  ah(async (req, res) => {
    if (!isId(req.params.rid)) throw new ApiError(404, 'Reply not found');
    const r = await Reply.findById(req.params.rid);
    if (!r) throw new ApiError(404, 'Reply not found');
    const d = await Discussion.findById(r.discussion);
    if (String(d.author) !== String(req.user._id) && !(await isMod(req.user))) throw new ApiError(403, 'Only the asker can mark a helpful answer');
    r.helpful = !r.helpful;
    await r.save();
    d.resolved = r.helpful ? true : (await Reply.exists({ discussion: d._id, helpful: true })) != null;
    await d.save();
    res.json({ helpful: r.helpful, resolved: d.resolved });
  })
);

router.post(
  '/:kind(discussion|reply)/:id/report',
  ah(async (req, res) => {
    const Model = req.params.kind === 'discussion' ? Discussion : Reply;
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Not found');
    if (doc.reports.some((x) => String(x.user) === String(req.user._id))) throw new ApiError(409, 'You have already reported this');
    doc.reports.push({ user: req.user._id, reason });
    await doc.save();
    res.status(201).json({ message: 'Thanks, a moderator will review this.' });
  })
);

export default router;
