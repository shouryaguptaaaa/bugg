import { Router } from 'express';
import { z } from 'zod';
import { Material } from '../models/Material.js';
import { User } from '../models/User.js';
import { Course, Subject, Semester } from '../models/Academic.js';
import { Announcement, FAQ, ContactMessage } from '../models/Platform.js';
import { ah } from '../utils/helpers.js';
import { getSettings } from '../utils/settings.js';
import { Download } from '../models/Material.js';

const router = Router();
const POP = [
  { path: 'subject', select: 'name code' },
  { path: 'category', select: 'name' },
  { path: 'semester', select: 'number name' },
];
const live = () => ({ deletedAt: null, status: 'published', $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] });

router.get(
  '/settings',
  ah(async (_req, res) => {
    const s = await getSettings();
    const o = s.toObject();
    delete o.rolePermissions;
    delete o._id;
    delete o.__v;
    res.set('Cache-Control', 'public, max-age=60').json(o);
  })
);

router.get(
  '/home',
  ah(async (_req, res) => {
    const [materials, students, subjects, downloads, courses, recent, mostDownloaded, featured, announcements, faqs, popularSubjects] = await Promise.all([
      Material.countDocuments(live()),
      User.countDocuments({ role: 'student', status: 'active' }),
      Subject.countDocuments(),
      Download.countDocuments(),
      Course.find({ active: true }).sort({ name: 1 }),
      Material.find(live()).sort({ createdAt: -1 }).limit(6).populate(POP),
      Material.find({ ...live(), downloads: { $gt: 0 } }).sort({ downloads: -1 }).limit(6).populate(POP),
      Material.find({ ...live(), featured: true }).sort({ updatedAt: -1 }).limit(6).populate(POP),
      Announcement.find({ published: true }).sort({ createdAt: -1 }).limit(4),
      FAQ.find({ published: true }).sort({ order: 1, createdAt: 1 }).limit(10),
      Material.aggregate([
        { $match: { deletedAt: null, status: 'published' } },
        { $group: { _id: '$subject', materials: { $sum: 1 }, downloads: { $sum: '$downloads' } } },
        { $sort: { downloads: -1, materials: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
        { $unwind: '$subject' },
        { $project: { _id: 1, name: '$subject.name', code: '$subject.code', materials: 1, downloads: 1 } },
      ]),
    ]);
    // distinct semester numbers actually defined by admins
    const semesterNumbers = (await Semester.distinct('number')).sort((a, b) => a - b);
    res.json({
      stats: { materials, students, subjects, downloads },
      courses,
      semesterNumbers,
      recent,
      mostDownloaded,
      featured,
      announcements,
      faqs,
      popularSubjects,
    });
  })
);

router.get('/faqs', ah(async (_req, res) => res.json({ items: await FAQ.find({ published: true }).sort({ order: 1, createdAt: 1 }) })));

router.get(
  '/announcements',
  ah(async (_req, res) => res.json({ items: await Announcement.find({ published: true }).sort({ createdAt: -1 }).limit(30) }))
);

router.post(
  '/contact',
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2, 'Enter your name').max(100),
        email: z.string().trim().email('Enter a valid email'),
        subject: z.string().trim().max(200).optional(),
        message: z.string().trim().min(10, 'Message is too short').max(3000),
      })
      .parse(req.body);
    await ContactMessage.create(data);
    res.status(201).json({ message: 'Message sent. We will get back to you soon.' });
  })
);

export default router;
