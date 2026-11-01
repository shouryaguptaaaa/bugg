import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Assignment, Submission } from '../models/Learning.js';
import { Subject } from '../models/Academic.js';
import { authenticate, can } from '../middleware/auth.js';
import { ah, ApiError, audit, isId, pageParams } from '../utils/helpers.js';
import { validateUpload } from '../utils/fileTypes.js';
import { saveBuffer, openStream, removeFile } from '../utils/storage.js';
import { userCan } from '../utils/settings.js';
import { notify } from '../utils/notify.js';
import { env } from '../config/env.js';

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileMb * 1024 * 1024, files: 1 } });
const DOC_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.jpg', '.jpeg', '.png'];
const POP = [
  { path: 'subject', select: 'name code' },
  { path: 'semester', select: 'number name' },
];

async function storeUpload(file) {
  if (!file) return null;
  let info;
  try {
    info = validateUpload(file, DOC_EXTS);
  } catch (m) {
    throw new ApiError(400, String(m));
  }
  const stored = await saveBuffer(file.buffer, info.ext, 'assignments');
  return { ...stored, originalName: file.originalname, mimeType: info.mime, ext: info.ext, size: file.size };
}

function sendFile(res, file, disposition = 'attachment') {
  return openStream(file).then((stream) => {
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  subject: z.string().refine(isId, 'Choose a subject'),
  dueDate: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid due date'),
  maxMarks: z.coerce.number().min(1).max(1000).optional(),
  allowLate: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  published: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
});
const bool = (v) => (v === undefined ? undefined : v === true || v === 'true');

// ------------------------------------------------------------------ STUDENT

router.get(
  '/',
  ah(async (req, res) => {
    const filter = { published: true };
    if (req.query.subject && isId(String(req.query.subject))) filter.subject = req.query.subject;
    const items = await Assignment.find(filter).sort({ dueDate: 1 }).limit(200).populate(POP);
    const subs = await Submission.find({ student: req.user._id, assignment: { $in: items.map((a) => a._id) } });
    const map = new Map(subs.map((s) => [String(s.assignment), s]));
    const now = Date.now();
    res.json({
      items: items.map((a) => {
        const s = map.get(String(a._id));
        const status = s ? (s.status === 'reviewed' ? 'reviewed' : s.late ? 'submitted_late' : 'submitted') : a.dueDate.getTime() < now ? 'overdue' : 'pending';
        return { ...a.toJSON(), submission: s || null, status };
      }),
    });
  })
);

router.get(
  '/manage/list',
  can('assignments.manage'),
  ah(async (_req, res) => {
    const items = await Assignment.find().sort({ dueDate: -1 }).limit(200).populate(POP);
    const counts = await Submission.aggregate([{ $group: { _id: '$assignment', n: { $sum: 1 }, reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } } } }]);
    const map = new Map(counts.map((c) => [String(c._id), c]));
    res.json({ items: items.map((a) => ({ ...a.toJSON(), submissionCount: map.get(String(a._id))?.n || 0, reviewedCount: map.get(String(a._id))?.reviewed || 0 })) });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Assignment not found');
    const a = await Assignment.findById(req.params.id).populate(POP);
    if (!a || (!a.published && !(await userCan(req.user, 'assignments.manage')))) throw new ApiError(404, 'Assignment not found');
    const submission = await Submission.findOne({ assignment: a._id, student: req.user._id });
    res.json({ assignment: a, submission });
  })
);

router.get(
  '/:id/reference',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
    const a = await Assignment.findById(req.params.id);
    if (!a?.referenceFile || (!a.published && !(await userCan(req.user, 'assignments.manage')))) throw new ApiError(404, 'No reference document');
    await sendFile(res, a.referenceFile);
  })
);

router.post(
  '/:id/submit',
  upload.single('file'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Assignment not found');
    const a = await Assignment.findOne({ _id: req.params.id, published: true });
    if (!a) throw new ApiError(404, 'Assignment not found');
    if (!req.file) throw new ApiError(400, 'Attach your file');
    const late = Date.now() > a.dueDate.getTime();
    if (late && !a.allowLate) throw new ApiError(400, 'The deadline has passed and late submissions are not accepted');
    const note = String(req.body.note || '').slice(0, 1000);
    const file = await storeUpload(req.file);
    let sub = await Submission.findOne({ assignment: a._id, student: req.user._id });
    if (sub) {
      if (sub.status === 'reviewed') {
        await removeFile(file);
        throw new ApiError(400, 'This submission has already been graded and can no longer be changed');
      }
      sub.history.push({ file: sub.file, note: sub.note, submittedAt: sub.submittedAt, late: sub.late }); // submission history
      sub.file = file;
      sub.note = note;
      sub.submittedAt = new Date();
      sub.late = late;
      await sub.save();
    } else {
      sub = await Submission.create({ assignment: a._id, student: req.user._id, file, note, late });
    }
    res.status(201).json({ submission: sub, message: late ? 'Submitted (marked as late)' : 'Submitted successfully' });
  })
);

router.get(
  '/submissions/:sid/file',
  ah(async (req, res) => {
    if (!isId(req.params.sid)) throw new ApiError(404, 'Not found');
    const sub = await Submission.findById(req.params.sid);
    if (!sub) throw new ApiError(404, 'Submission not found');
    const isOwner = String(sub.student) === String(req.user._id);
    if (!isOwner && !(await userCan(req.user, 'assignments.manage'))) throw new ApiError(403, 'Not allowed'); // ownership check
    const h = req.query.v !== undefined ? sub.history[Number(req.query.v)] : null;
    await sendFile(res, (h || sub).file);
  })
);

// ------------------------------------------------------------------ ADMIN

router.post(
  '/',
  can('assignments.manage'),
  upload.single('reference'),
  ah(async (req, res) => {
    const data = schema.parse(req.body);
    const subject = await Subject.findById(data.subject);
    if (!subject) throw new ApiError(400, 'Subject not found');
    const a = await Assignment.create({
      ...data,
      dueDate: new Date(data.dueDate),
      allowLate: bool(data.allowLate) ?? true,
      published: bool(data.published) ?? true,
      semester: subject.semester,
      referenceFile: await storeUpload(req.file),
      createdBy: req.user._id,
    });
    await audit(req, 'assignment.create', 'Assignment', a._id, { title: a.title });
    if (a.published) notify({ role: 'student' }, { type: 'assignment', title: `New assignment: ${a.title}`, body: `Due ${a.dueDate.toLocaleDateString('en-IN')}`, link: `/assignments/${a._id}` });
    res.status(201).json(a);
  })
);

router.patch(
  '/:id',
  can('assignments.manage'),
  upload.single('reference'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Assignment not found');
    const a = await Assignment.findById(req.params.id);
    if (!a) throw new ApiError(404, 'Assignment not found');
    const data = schema.partial().parse(req.body);
    if (data.subject && data.subject !== String(a.subject)) {
      const subject = await Subject.findById(data.subject);
      if (!subject) throw new ApiError(400, 'Subject not found');
      a.subject = subject._id;
      a.semester = subject.semester;
    }
    for (const k of ['title', 'description', 'maxMarks']) if (data[k] !== undefined) a[k] = data[k];
    if (data.dueDate) {
      a.dueDate = new Date(data.dueDate);
      a.deadlineNotified = false;
    }
    if (data.allowLate !== undefined) a.allowLate = bool(data.allowLate);
    if (data.published !== undefined) a.published = bool(data.published);
    if (req.file) {
      await removeFile(a.referenceFile);
      a.referenceFile = await storeUpload(req.file);
    }
    await a.save();
    await audit(req, 'assignment.update', 'Assignment', a._id);
    res.json(a);
  })
);

router.delete(
  '/:id',
  can('assignments.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Assignment not found');
    const a = await Assignment.findByIdAndDelete(req.params.id);
    if (!a) throw new ApiError(404, 'Assignment not found');
    const subs = await Submission.find({ assignment: a._id });
    for (const s of subs) {
      await removeFile(s.file);
      for (const h of s.history) await removeFile(h.file);
    }
    await Submission.deleteMany({ assignment: a._id });
    await removeFile(a.referenceFile);
    await audit(req, 'assignment.delete', 'Assignment', a._id, { title: a.title });
    res.json({ message: 'Assignment deleted' });
  })
);

router.get(
  '/:id/submissions',
  can('assignments.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Assignment not found');
    const { page, limit, skip } = pageParams(req.query, 25, 100);
    const filter = { assignment: req.params.id };
    const [items, total, assignment] = await Promise.all([
      Submission.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).populate('student', 'name email enrollmentNo'),
      Submission.countDocuments(filter),
      Assignment.findById(req.params.id).select('title maxMarks dueDate'),
    ]);
    res.json({ assignment, items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

router.patch(
  '/submissions/:sid/review',
  can('assignments.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.sid)) throw new ApiError(404, 'Not found');
    const data = z.object({ marks: z.coerce.number().min(0), feedback: z.string().trim().max(2000).optional() }).parse(req.body);
    const sub = await Submission.findById(req.params.sid).populate('assignment', 'title maxMarks');
    if (!sub) throw new ApiError(404, 'Submission not found');
    if (data.marks > sub.assignment.maxMarks) throw new ApiError(400, `Marks cannot exceed ${sub.assignment.maxMarks}`);
    sub.marks = data.marks;
    sub.feedback = data.feedback;
    sub.status = 'reviewed';
    sub.reviewedBy = req.user._id;
    sub.reviewedAt = new Date();
    await sub.save();
    await audit(req, 'submission.review', 'Submission', sub._id, { marks: data.marks });
    notify([sub.student], { type: 'assignment', title: `Assignment graded: ${sub.assignment.title}`, body: `You scored ${data.marks}/${sub.assignment.maxMarks}`, link: `/assignments/${sub.assignment._id}` });
    res.json(sub);
  })
);

export default router;
