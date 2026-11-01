import { Router } from 'express';
import { z } from 'zod';
import { Notification } from '../models/Personal.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ah, ApiError, isId, pageParams } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 20, 50);
    const filter = { user: req.user._id };
    if (req.query.unread === '1') filter.read = false;
    if (req.query.type) filter.type = String(req.query.type);
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ items, total, unread, page, pages: Math.ceil(total / limit) || 1 });
  })
);

router.get('/unread-count', ah(async (req, res) => res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) })));

router.post(
  '/read-all',
  ah(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  })
);

router.get('/prefs', ah(async (req, res) => res.json(req.user.notifyPrefs || {})));

router.put(
  '/prefs',
  ah(async (req, res) => {
    const keys = ['material', 'announcement', 'quiz', 'assignment', 'approval', 'account', 'email'];
    const data = z.object(Object.fromEntries(keys.map((k) => [k, z.boolean().optional()]))).parse(req.body);
    const user = await User.findById(req.user._id);
    for (const k of keys) if (data[k] !== undefined) user.set(`notifyPrefs.${k}`, data[k]);
    await user.save();
    res.json(user.notifyPrefs);
  })
);

router.patch(
  '/:id/read',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!n) throw new ApiError(404, 'Notification not found');
    res.json(n);
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted' });
  })
);

export default router;
