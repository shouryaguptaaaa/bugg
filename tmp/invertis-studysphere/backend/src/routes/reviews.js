import { Router } from 'express';
import { z } from 'zod';
import { Review } from '../models/Personal.js';
import { Material } from '../models/Material.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { ah, ApiError, isId } from '../utils/helpers.js';

const router = Router();

router.get(
  '/:id/reviews',
  optionalAuth,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const items = await Review.find({ material: req.params.id }).sort({ createdAt: -1 }).limit(50).populate('user', 'name');
    const avg = items.length ? Math.round((items.reduce((s, r) => s + r.rating, 0) / items.length) * 10) / 10 : 0;
    res.json({ average: avg, count: items.length, mine: req.user ? items.find((r) => String(r.user._id) === String(req.user._id)) || null : null, items });
  })
);

router.put(
  '/:id/reviews',
  authenticate,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    const d = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(req.body);
    if (!(await Material.exists({ _id: req.params.id, deletedAt: null, status: 'published' }))) throw new ApiError(404, 'Material not found');
    const r = await Review.findOneAndUpdate({ material: req.params.id, user: req.user._id }, d, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json(r);
  })
);

router.delete(
  '/:id/reviews',
  authenticate,
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Material not found');
    await Review.deleteOne({ material: req.params.id, user: req.user._id });
    res.json({ message: 'Review removed' });
  })
);

export default router;
