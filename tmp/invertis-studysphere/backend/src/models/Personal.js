import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

export const Notification = mongoose.model(
  'Notification',
  (() => {
    const s = new Schema(
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['material', 'announcement', 'quiz', 'assignment', 'approval', 'account'], required: true },
        title: { type: String, required: true, maxlength: 200 },
        body: { type: String, maxlength: 500, default: '' },
        link: { type: String, maxlength: 200 },
        read: { type: Boolean, default: false },
      },
      opts
    );
    s.index({ user: 1, read: 1, createdAt: -1 });
    return s;
  })()
);

export const StudyPlan = mongoose.model(
  'StudyPlan',
  (() => {
    const s = new Schema(
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        kind: { type: String, enum: ['study', 'goal', 'exam', 'assignment', 'todo'], default: 'study' },
        subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
        date: { type: Date }, // todo items may have no date
        durationMin: { type: Number, min: 0, max: 1440 },
        notes: { type: String, trim: true, maxlength: 1000 },
        reminderAt: { type: Date },
        reminderSent: { type: Boolean, default: false },
        done: { type: Boolean, default: false },
        doneAt: { type: Date },
      },
      opts
    );
    s.index({ user: 1, date: 1 });
    s.index({ reminderAt: 1, reminderSent: 1 });
    return s;
  })()
);

export const PersonalNote = mongoose.model(
  'PersonalNote',
  (() => {
    const s = new Schema(
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        body: { type: String, trim: true, maxlength: 20000, default: '' },
        subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
        pinned: { type: Boolean, default: false },
      },
      opts
    );
    s.index({ user: 1, pinned: -1, updatedAt: -1 });
    return s;
  })()
);

// Custom study folders / bookmark collections
export const Folder = mongoose.model(
  'Folder',
  (() => {
    const s = new Schema(
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        materials: [{ type: Schema.Types.ObjectId, ref: 'Material' }],
      },
      opts
    );
    s.index({ user: 1, name: 1 }, { unique: true });
    return s;
  })()
);

export const ReadingProgress = mongoose.model(
  'ReadingProgress',
  (() => {
    const s = new Schema(
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
        percent: { type: Number, min: 0, max: 100, default: 0 },
      },
      opts
    );
    s.index({ user: 1, material: 1 }, { unique: true });
    return s;
  })()
);

export const SearchHistory = mongoose.model(
  'SearchHistory',
  (() => {
    const s = new Schema({ user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, q: { type: String, required: true, maxlength: 100 } }, { timestamps: { createdAt: true, updatedAt: true } });
    s.index({ user: 1, updatedAt: -1 });
    s.index({ user: 1, q: 1 }, { unique: true });
    return s;
  })()
);

export const Review = mongoose.model(
  'Review',
  (() => {
    const s = new Schema(
      {
        material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, maxlength: 500, default: '' },
      },
      opts
    );
    s.index({ material: 1, user: 1 }, { unique: true });
    return s;
  })()
);
