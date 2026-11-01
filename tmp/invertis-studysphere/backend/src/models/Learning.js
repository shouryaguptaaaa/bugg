import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

// ------------------------------------------------------------------ QUIZZES

const quizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: String, enum: ['mock_test', 'practice', 'topic_test', 'weekly', 'other'], default: 'mock_test', index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', index: true },
    durationMinutes: { type: Number, min: 1, max: 360, default: 30 }, // timed examination
    randomize: { type: Boolean, default: true },
    passPercent: { type: Number, min: 0, max: 100, default: 40 },
    published: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  opts
);
export const Quiz = mongoose.model('Quiz', quizSchema);

const questionSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [{ type: String, trim: true, maxlength: 400 }],
      validate: [(v) => v.length >= 2 && v.length <= 6, 'A question needs 2 to 6 options'],
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, trim: true, maxlength: 1000, default: '' },
    topic: { type: String, trim: true, lowercase: true, maxlength: 80, index: true },
  },
  opts
);
export const Question = mongoose.model('Question', questionSchema);

const attemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', index: true }, // null for topic practice
    mode: { type: String, enum: ['quiz', 'practice'], default: 'quiz' },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', index: true },
    topic: { type: String },
    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }], // order shown to the student
    answers: [{ question: { type: Schema.Types.ObjectId, ref: 'Question' }, selected: Number, correct: Boolean }],
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress', index: true },
    startedAt: { type: Date, default: Date.now },
    deadline: { type: Date }, // null = untimed
    submittedAt: { type: Date },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    timeTakenSec: { type: Number, default: 0 },
  },
  opts
);
attemptSchema.index({ user: 1, status: 1, submittedAt: -1 });
attemptSchema.index({ quiz: 1, status: 1, percent: -1 });
export const QuizAttempt = mongoose.model('QuizAttempt', attemptSchema);

// ------------------------------------------------------------------ ASSIGNMENTS

const fileRef = new Schema(
  {
    storage: String,
    key: String,
    url: String,
    originalName: String,
    mimeType: String,
    ext: String,
    size: Number,
  },
  { _id: false }
);

const assignmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', index: true },
    dueDate: { type: Date, required: true, index: true },
    maxMarks: { type: Number, min: 1, max: 1000, default: 10 },
    allowLate: { type: Boolean, default: true },
    published: { type: Boolean, default: true, index: true },
    referenceFile: { type: fileRef },
    deadlineNotified: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  opts
);
assignmentSchema.set('toJSON', {
  transform(_d, r) {
    if (r.referenceFile) r.referenceFile = { originalName: r.referenceFile.originalName, size: r.referenceFile.size, ext: r.referenceFile.ext };
    delete r.__v;
    return r;
  },
});
export const Assignment = mongoose.model('Assignment', assignmentSchema);

const submissionSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    file: { type: fileRef, required: true },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    submittedAt: { type: Date, default: Date.now },
    late: { type: Boolean, default: false },
    status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted', index: true },
    marks: { type: Number, min: 0 },
    feedback: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    history: [{ file: fileRef, note: String, submittedAt: Date, late: Boolean }], // previous submissions
  },
  opts
);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.set('toJSON', {
  transform(_d, r) {
    const strip = (f) => f && { originalName: f.originalName, size: f.size, ext: f.ext };
    r.file = strip(r.file);
    if (r.history) r.history = r.history.map((h) => ({ file: strip(h.file), note: h.note, submittedAt: h.submittedAt, late: h.late }));
    delete r.__v;
    return r;
  },
});
export const Submission = mongoose.model('Submission', submissionSchema);
