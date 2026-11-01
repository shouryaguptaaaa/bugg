import { Router } from 'express';
import { Material, Download, View, Bookmark } from '../models/Material.js';
import { Announcement } from '../models/Platform.js';
import { Notification, StudyPlan, ReadingProgress, SearchHistory } from '../models/Personal.js';
import { QuizAttempt, Assignment, Submission } from '../models/Learning.js';
import { authenticate } from '../middleware/auth.js';
import { ah, pageParams } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

const POP = [
  { path: 'subject', select: 'name code' },
  { path: 'category', select: 'name' },
  { path: 'semester', select: 'number name' },
];
const live = () => ({ deletedAt: null, status: 'published', $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] });

// Collapses a list of event docs to the most recent unique materials
function uniqueMaterials(events, max) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    if (!e.material) continue;
    const id = String(e.material._id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ material: e.material, at: e.createdAt });
    if (out.length >= max) break;
  }
  return out;
}

router.get(
  '/dashboard',
  ah(async (req, res) => {
    const uid = req.user._id;
    const matMatch = { path: 'material', match: live(), populate: POP };
    const [recentViewsRaw, recentUploads, popular, bookmarkCount, downloadCount, viewCount, announcements, recentDownloadsRaw, unread, notifications, upcoming, progressRows, searches, quizAgg, dueAssignments] = await Promise.all([
      View.find({ user: uid }).sort({ createdAt: -1 }).limit(30).populate(matMatch),
      Material.find(live()).sort({ createdAt: -1 }).limit(6).populate(POP),
      Material.find(live()).sort({ downloads: -1, views: -1 }).limit(6).populate(POP),
      Bookmark.countDocuments({ user: uid }),
      Download.countDocuments({ user: uid }),
      View.countDocuments({ user: uid }),
      Announcement.find({ published: true }).sort({ createdAt: -1 }).limit(4),
      Download.find({ user: uid }).sort({ createdAt: -1 }).limit(30).populate(matMatch),
      Notification.countDocuments({ user: uid, read: false }),
      Notification.find({ user: uid }).sort({ createdAt: -1 }).limit(5),
      StudyPlan.find({ user: uid, done: false, date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }).sort({ date: 1 }).limit(5).populate('subject', 'name'),
      ReadingProgress.find({ user: uid }).sort({ updatedAt: -1 }).limit(20).populate({ path: 'material', select: 'title deletedAt status' }),
      SearchHistory.find({ user: uid }).sort({ updatedAt: -1 }).limit(6),
      QuizAttempt.aggregate([{ $match: { user: uid, status: 'submitted' } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: '$percent' } } }]),
      Assignment.find({ published: true, dueDate: { $gte: new Date() } }).sort({ dueDate: 1 }).limit(10).select('title dueDate'),
    ]);
    const submittedIds = new Set((await Submission.find({ student: uid, assignment: { $in: dueAssignments.map((a) => a._id) } }).select('assignment')).map((s) => String(s.assignment)));
    const prog = progressRows.filter((p) => p.material && !p.material.deletedAt && p.material.status === 'published');
    // Subject-wise resources: subjects the student has opened most
    const subjectCounts = {};
    for (const v of recentViewsRaw) {
      const s = v.material?.subject;
      if (s) subjectCounts[s._id] = { subject: s, count: (subjectCounts[s._id]?.count || 0) + 1 };
    }
    res.json({
      stats: { bookmarks: bookmarkCount, downloads: downloadCount, views: viewCount },
      recentlyViewed: uniqueMaterials(recentViewsRaw, 6),
      recentDownloads: uniqueMaterials(recentDownloadsRaw, 4),
      recentUploads,
      popular,
      announcements,
      topSubjects: Object.values(subjectCounts).sort((a, b) => b.count - a.count).slice(0, 5),
      unreadNotifications: unread,
      notifications,
      upcomingPlans: upcoming,
      pendingAssignments: dueAssignments.filter((a) => !submittedIds.has(String(a._id))).slice(0, 5),
      learning: {
        completed: prog.filter((p) => p.percent >= 100).length,
        inProgress: prog.filter((p) => p.percent < 100).length,
        inProgressItems: prog.filter((p) => p.percent < 100).slice(0, 4).map((p) => ({ _id: p.material._id, title: p.material.title, percent: p.percent })),
        quizAttempts: quizAgg[0]?.n || 0,
        quizAverage: quizAgg[0] ? Math.round(quizAgg[0].avg * 10) / 10 : 0,
      },
      searches,
    });
  })
);

router.get(
  '/downloads',
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 15);
    const filter = { user: req.user._id };
    const [rows, total] = await Promise.all([
      Download.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate({ path: 'material', populate: POP }),
      Download.countDocuments(filter),
    ]);
    res.json({ items: rows.map((r) => ({ _id: r._id, at: r.createdAt, material: r.material })), total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

router.get(
  '/bookmarks',
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 12);
    const filter = { user: req.user._id };
    const [rows, total] = await Promise.all([
      Bookmark.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate({ path: 'material', match: live(), populate: POP }),
      Bookmark.countDocuments(filter),
    ]);
    res.json({ items: rows.map((r) => r.material).filter(Boolean), total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

export default router;
