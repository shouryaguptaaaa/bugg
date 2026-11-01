import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

const flagSchema = [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 300 }, at: { type: Date, default: Date.now } }];

const discussionSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    replyCount: { type: Number, default: 0 },
    resolved: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false, index: true }, // moderation
    reports: flagSchema,
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  opts
);
discussionSchema.index({ title: 'text', body: 'text' });
export const Discussion = mongoose.model('Discussion', discussionSchema);

const replySchema = new Schema(
  {
    discussion: { type: Schema.Types.ObjectId, ref: 'Discussion', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    helpful: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false, index: true },
    reports: flagSchema,
  },
  opts
);
export const Reply = mongoose.model('Reply', replySchema);
