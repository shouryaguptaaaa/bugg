import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Quiz, Question, QuizAttempt } from '../models/Learning.js';
import { Subject } from '../models/Academic.js';
import { authenticate, can } from '../middleware/auth.js';
import { ah, ApiError, audit, isId, pageParams } from '../utils/helpers.js';
import { notify } from '../utils/notify.js';

const router = Router();
router.use(authenticate);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const POP = [
  { path: 'subject', select: 'name code' },
  { path: 'semester', select: 'number name' },
];
const GRACE_MS = 15_000; // network grace when a timed quiz is submitted at the buzzer

const quizSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(['mock_test', 'practice', 'topic_test', 'weekly', 'other']).optional(),
  subject: z.string().refine(isId, 'Choose a subject'),
  durationMinutes: z.coerce.number().int().min(1).max(360).optional(),
  randomize: z.boolean().optional(),
  passPercent: z.coerce.number().min(0).max(100).optional(),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(3).max(1000),
    options: z.array(z.string().trim().min(1).max(400)).min(2).max(6),
    correctIndex: z.coerce.number().int().min(0),
    explanation: z.string().trim().max(1000).optional(),
    topic: z.string().trim().max(80).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, { message: 'Correct answer must be one of the options', path: ['correctIndex'] });

// Student-facing question: never includes the answer
const publicQuestion = (q) => ({ _id: q._id, text: q.text, options: q.options, topic: q.topic });

// ------------------------------------------------------------------ STUDENT: browse

router.get(
  '/',
  ah(async (req, res) => {
    const filter = { published: true };
    if (req.query.subject && isId(String(req.query.subject))) filter.subject = req.query.subject;
    if (req.query.semester && isId(String(req.query.semester))) filter.semester = req.query.semester;
    if (req.query.category) filter.category = String(req.query.category);
    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).limit(100).populate(POP);
    const ids = quizzes.map((q) => q._id);
    const [counts, mine] = await Promise.all([
      Question.aggregate([{ $match: { quiz: { $in: ids } } }, { $group: { _id: '$quiz', n: { $sum: 1 } } }]),
      QuizAttempt.aggregate([
        { $match: { user: req.user._id, quiz: { $in: ids }, status: 'submitted' } },
        { $group: { _id: '$quiz', best: { $max: '$percent' }, attempts: { $sum: 1 } } },
      ]),
    ]);
    const cMap = new Map(counts.map((c) => [String(c._id), c.n]));
    const mMap = new Map(mine.map((c) => [String(c._id), c]));
    res.json({
      items: quizzes
        .filter((q) => cMap.get(String(q._id)))
        .map((q) => ({ ...q.toJSON(), questionCount: cMap.get(String(q._id)), bestPercent: mMap.get(String(q._id))?.best ?? null, attempts: mMap.get(String(q._id))?.attempts ?? 0 })),
    });
  })
);

// Topics available for practice (from published quizzes)
router.get(
  '/practice/topics',
  ah(async (req, res) => {
    const quizIds = await Quiz.find({ published: true, ...(isId(String(req.query.subject)) ? { subject: req.query.subject } : {}) }).distinct('_id');
    const rows = await Question.aggregate([
      { $match: { quiz: { $in: quizIds }, topic: { $nin: [null, ''] } } },
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);
    res.json({ items: rows.map((r) => ({ topic: r._id, count: r.count })) });
  })
);

// ------------------------------------------------------------------ STUDENT: attempts

async function startAttempt(user, { quiz, questions, mode, subject, topic, minutes }) {
  return QuizAttempt.create({
    user: user._id,
    quiz: quiz?._id,
    mode,
    subject,
    topic,
    questions,
    deadline: minutes ? new Date(Date.now() + minutes * 60_000) : undefined,
  });
}

async function attemptPayload(attempt) {
  const qs = await Question.find({ _id: { $in: attempt.questions } });
  const map = new Map(qs.map((q) => [String(q._id), q]));
  const ordered = attempt.questions.map((id) => map.get(String(id))).filter(Boolean);
  const quiz = attempt.quiz ? await Quiz.findById(attempt.quiz).select('title durationMinutes passPercent') : null;
  return {
    attempt: { _id: attempt._id, mode: attempt.mode, topic: attempt.topic, startedAt: attempt.startedAt, deadline: attempt.deadline, status: attempt.status },
    quiz,
    questions: ordered.map(publicQuestion),
    serverTime: new Date(),
  };
}

router.post(
  '/practice/start',
  ah(async (req, res) => {
    const data = z.object({ subject: z.string().refine(isId).optional(), topic: z.string().trim().max(80).optional(), count: z.coerce.number().int().min(3).max(30).default(10) }).parse(req.body);
    if (!data.subject && !data.topic) throw new ApiError(400, 'Choose a subject or a topic to practise');
    const quizFilter = { published: true };
    if (data.subject) quizFilter.subject = data.subject;
    const quizIds = await Quiz.find(quizFilter).distinct('_id');
    const qFilter = { quiz: { $in: quizIds } };
    if (data.topic) qFilter.topic = data.topic.toLowerCase();
    const pool = await Question.find(qFilter).select('_id');
    if (pool.length < 3) throw new ApiError(404, 'Not enough questions yet for this selection');
    const picked = shuffle(pool).slice(0, data.count).map((q) => q._id);
    const attempt = await startAttempt(req.user, { mode: 'practice', questions: picked, subject: data.subject, topic: data.topic?.toLowerCase() });
    res.status(201).json(await attemptPayload(attempt));
  })
);

router.post(
  '/:id/start',
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Quiz not found');
    const quiz = await Quiz.findOne({ _id: req.params.id, published: true });
    if (!quiz) throw new ApiError(404, 'Quiz not found');
    // Resume an unfinished attempt that is still within time
    const open = await QuizAttempt.findOne({ user: req.user._id, quiz: quiz._id, status: 'in_progress' }).sort({ createdAt: -1 });
    if (open && (!open.deadline || open.deadline.getTime() + GRACE_MS > Date.now())) return res.json(await attemptPayload(open));
    if (open) await gradeAttempt(open, {}); // expired: auto-submit with whatever it had (nothing)
    const qs = await Question.find({ quiz: quiz._id }).select('_id');
    if (!qs.length) throw new ApiError(400, 'This quiz has no questions yet');
    const ids = (quiz.randomize ? shuffle(qs) : qs).map((q) => q._id);
    const attempt = await startAttempt(req.user, { quiz, questions: ids, mode: 'quiz', subject: quiz.subject, minutes: quiz.durationMinutes });
    res.status(201).json(await attemptPayload(attempt));
  })
);

/** Evaluates answers on the server. Answers = { [questionId]: optionIndex } */
async function gradeAttempt(attempt, answers) {
  const qs = await Question.find({ _id: { $in: attempt.questions } });
  const map = new Map(qs.map((q) => [String(q._id), q]));
  let score = 0;
  attempt.answers = attempt.questions.map((id) => {
    const q = map.get(String(id));
    const sel = Number.isInteger(answers[String(id)]) ? answers[String(id)] : undefined;
    const correct = q != null && sel === q.correctIndex;
    if (correct) score++;
    return { question: id, selected: sel, correct };
  });
  attempt.total = attempt.questions.length;
  attempt.score = score;
  attempt.percent = attempt.total ? Math.round((score / attempt.total) * 1000) / 10 : 0;
  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.timeTakenSec = Math.round((attempt.submittedAt - attempt.startedAt) / 1000);
  await attempt.save();
  return attempt;
}

async function resultPayload(attempt) {
  const qs = await Question.find({ _id: { $in: attempt.questions } });
  const map = new Map(qs.map((q) => [String(q._id), q]));
  const quiz = attempt.quiz ? await Quiz.findById(attempt.quiz).select('title passPercent subject').populate('subject', 'name') : null;
  const review = attempt.answers.map((a) => {
    const q = map.get(String(a.question));
    return { _id: a.question, text: q?.text, options: q?.options, topic: q?.topic, explanation: q?.explanation, selected: a.selected ?? null, correctIndex: q?.correctIndex, correct: a.correct };
  });
  return {
    attempt: { _id: attempt._id, mode: attempt.mode, topic: attempt.topic, score: attempt.score, total: attempt.total, percent: attempt.percent, timeTakenSec: attempt.timeTakenSec, submittedAt: attempt.submittedAt, status: attempt.status },
    quiz,
    passed: quiz ? attempt.percent >= quiz.passPercent : null,
    review,
  };
}

router.post(
  '/attempts/:attemptId/submit',
  ah(async (req, res) => {
    if (!isId(req.params.attemptId)) throw new ApiError(404, 'Attempt not found');
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id });
    if (!attempt) throw new ApiError(404, 'Attempt not found');
    if (attempt.status === 'submitted') return res.json(await resultPayload(attempt));
    const { answers } = z.object({ answers: z.record(z.coerce.number().int().min(0).max(10)).default({}) }).parse(req.body);
    // Timed exam: answers that arrive after the deadline (+ grace) are rejected, the attempt is graded as blank
    const late = attempt.deadline && Date.now() > attempt.deadline.getTime() + GRACE_MS;
    await gradeAttempt(attempt, late ? {} : answers);
    res.json({ ...(await resultPayload(attempt)), timedOut: Boolean(late) });
  })
);

router.get(
  '/attempts/:attemptId',
  ah(async (req, res) => {
    if (!isId(req.params.attemptId)) throw new ApiError(404, 'Attempt not found');
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, user: req.user._id });
    if (!attempt) throw new ApiError(404, 'Attempt not found');
    if (attempt.status !== 'submitted') return res.json({ inProgress: true, ...(await attemptPayload(attempt)) });
    res.json(await resultPayload(attempt));
  })
);

// Score history + quiz attempt history
router.get(
  '/me/history',
  ah(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query, 15);
    const filter = { user: req.user._id, status: 'submitted' };
    const [items, total] = await Promise.all([
      QuizAttempt.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).populate('quiz', 'title').populate('subject', 'name'),
      QuizAttempt.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  })
);

// Performance analytics (computed from real attempts)
router.get(
  '/me/analytics',
  ah(async (req, res) => {
    const attempts = await QuizAttempt.find({ user: req.user._id, status: 'submitted' }).sort({ submittedAt: 1 }).populate('quiz', 'title').populate('subject', 'name');
    const bySubject = {};
    for (const a of attempts) {
      const key = a.subject?._id ? String(a.subject._id) : 'none';
      const s = (bySubject[key] ||= { subject: a.subject?.name || 'Mixed', attempts: 0, sum: 0 });
      s.attempts++;
      s.sum += a.percent;
    }
    // weakest topics: answered wrong most often
    const topicRows = await QuizAttempt.aggregate([
      { $match: { user: req.user._id, status: 'submitted' } },
      { $unwind: '$answers' },
      { $lookup: { from: 'questions', localField: 'answers.question', foreignField: '_id', as: 'q' } },
      { $unwind: '$q' },
      { $match: { 'q.topic': { $nin: [null, ''] } } },
      { $group: { _id: '$q.topic', total: { $sum: 1 }, correct: { $sum: { $cond: ['$answers.correct', 1, 0] } } } },
      { $project: { topic: '$_id', total: 1, correct: 1, percent: { $round: [{ $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 1] } } },
      { $sort: { percent: 1 } },
      { $limit: 8 },
    ]);
    res.json({
      totalAttempts: attempts.length,
      averagePercent: attempts.length ? Math.round((attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) * 10) / 10 : 0,
      bestPercent: attempts.length ? Math.max(...attempts.map((a) => a.percent)) : 0,
      trend: attempts.slice(-20).map((a) => ({ date: a.submittedAt, percent: a.percent, title: a.quiz?.title || `Practice${a.topic ? `: ${a.topic}` : ''}` })),
      subjects: Object.values(bySubject).map((s) => ({ subject: s.subject, attempts: s.attempts, average: Math.round((s.sum / s.attempts) * 10) / 10 })),
      weakTopics: topicRows.map((t) => ({ topic: t.topic, total: t.total, percent: t.percent })),
    });
  })
);

// Leaderboard: each student's best score per quiz, ranked. Quiz-specific or overall.
router.get(
  '/leaderboard',
  ah(async (req, res) => {
    const match = { status: 'submitted', mode: 'quiz', quiz: { $ne: null } };
    if (req.query.quiz && isId(String(req.query.quiz))) match.quiz = new mongoose.Types.ObjectId(String(req.query.quiz));
    const rows = await QuizAttempt.aggregate([
      { $match: match },
      { $sort: { percent: -1, timeTakenSec: 1 } },
      { $group: { _id: { user: '$user', quiz: '$quiz' }, percent: { $first: '$percent' }, time: { $first: '$timeTakenSec' } } },
      { $group: { _id: '$_id.user', avg: { $avg: '$percent' }, quizzes: { $sum: 1 }, time: { $sum: '$time' } } },
      { $sort: { avg: -1, time: 1 } },
      { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { name: '$u.name', avgPercent: { $round: ['$avg', 1] }, quizzes: 1 } },
    ]);
    res.json({ items: rows.map((r, i) => ({ rank: i + 1, userId: r._id, name: r.name, avgPercent: r.avgPercent, quizzes: r.quizzes, isMe: String(r._id) === String(req.user._id) })) });
  })
);

// ------------------------------------------------------------------ ADMIN

router.get(
  '/manage/list',
  can('quizzes.manage'),
  ah(async (_req, res) => {
    const quizzes = await Quiz.find().sort({ createdAt: -1 }).limit(200).populate(POP);
    const counts = await Question.aggregate([{ $group: { _id: '$quiz', n: { $sum: 1 } } }]);
    const attempts = await QuizAttempt.aggregate([{ $match: { status: 'submitted' } }, { $group: { _id: '$quiz', n: { $sum: 1 } } }]);
    const c = new Map(counts.map((x) => [String(x._id), x.n]));
    const a = new Map(attempts.map((x) => [String(x._id), x.n]));
    res.json({ items: quizzes.map((q) => ({ ...q.toJSON(), questionCount: c.get(String(q._id)) || 0, attempts: a.get(String(q._id)) || 0 })) });
  })
);

router.post(
  '/',
  can('quizzes.manage'),
  ah(async (req, res) => {
    const data = quizSchema.parse(req.body);
    const subject = await Subject.findById(data.subject);
    if (!subject) throw new ApiError(400, 'Subject not found');
    const quiz = await Quiz.create({ ...data, semester: subject.semester, createdBy: req.user._id });
    await audit(req, 'quiz.create', 'Quiz', quiz._id, { title: quiz.title });
    res.status(201).json(quiz);
  })
);

router.get(
  '/:id/manage',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Quiz not found');
    const quiz = await Quiz.findById(req.params.id).populate(POP);
    if (!quiz) throw new ApiError(404, 'Quiz not found');
    res.json({ quiz, questions: await Question.find({ quiz: quiz._id }).sort({ createdAt: 1 }) });
  })
);

router.patch(
  '/:id',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Quiz not found');
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) throw new ApiError(404, 'Quiz not found');
    const data = quizSchema.partial().extend({ published: z.boolean().optional() }).parse(req.body);
    if (data.subject && data.subject !== String(quiz.subject)) {
      const subject = await Subject.findById(data.subject);
      if (!subject) throw new ApiError(400, 'Subject not found');
      quiz.semester = subject.semester;
    }
    const wasPublished = quiz.published;
    Object.assign(quiz, data);
    if (quiz.published && !(await Question.exists({ quiz: quiz._id }))) throw new ApiError(400, 'Add at least one question before publishing');
    await quiz.save();
    await audit(req, 'quiz.update', 'Quiz', quiz._id, { fields: Object.keys(data) });
    if (quiz.published && !wasPublished) notify({ role: 'student' }, { type: 'quiz', title: `New quiz: ${quiz.title}`, body: `${quiz.durationMinutes} minutes`, link: '/quizzes' });
    res.json(quiz);
  })
);

router.delete(
  '/:id',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Quiz not found');
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) throw new ApiError(404, 'Quiz not found');
    await Promise.all([Question.deleteMany({ quiz: quiz._id }), QuizAttempt.deleteMany({ quiz: quiz._id })]);
    await audit(req, 'quiz.delete', 'Quiz', quiz._id, { title: quiz.title });
    res.json({ message: 'Quiz deleted' });
  })
);

router.post(
  '/:id/questions',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.id)) throw new ApiError(404, 'Quiz not found');
    if (!(await Quiz.exists({ _id: req.params.id }))) throw new ApiError(404, 'Quiz not found');
    // Accepts one question or an array (bulk add)
    const list = z.array(questionSchema).min(1).max(200).parse(Array.isArray(req.body) ? req.body : [req.body]);
    const docs = await Question.insertMany(list.map((q) => ({ ...q, topic: q.topic?.toLowerCase(), quiz: req.params.id })));
    await audit(req, 'question.create', 'Quiz', req.params.id, { count: docs.length });
    res.status(201).json({ items: docs });
  })
);

router.patch(
  '/questions/:qid',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.qid)) throw new ApiError(404, 'Question not found');
    const q = await Question.findById(req.params.qid);
    if (!q) throw new ApiError(404, 'Question not found');
    const data = questionSchema.parse({ text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, topic: q.topic, ...req.body });
    Object.assign(q, { ...data, topic: data.topic?.toLowerCase() });
    await q.save();
    res.json(q);
  })
);

router.delete(
  '/questions/:qid',
  can('quizzes.manage'),
  ah(async (req, res) => {
    if (!isId(req.params.qid)) throw new ApiError(404, 'Question not found');
    const q = await Question.findByIdAndDelete(req.params.qid);
    if (!q) throw new ApiError(404, 'Question not found');
    const left = await Question.countDocuments({ quiz: q.quiz });
    if (!left) await Quiz.updateOne({ _id: q.quiz }, { published: false });
    res.json({ message: 'Question deleted' });
  })
);

export default router;
