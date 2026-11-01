import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

export const Announcement = mongoose.model(
  'Announcement',
  new Schema(
    {
      title: { type: String, required: true, trim: true, maxlength: 200 },
      body: { type: String, required: true, trim: true, maxlength: 3000 },
      priority: { type: String, enum: ['normal', 'important'], default: 'normal' },
      published: { type: Boolean, default: true, index: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    opts
  )
);

export const FAQ = mongoose.model(
  'FAQ',
  new Schema(
    {
      question: { type: String, required: true, trim: true, maxlength: 300 },
      answer: { type: String, required: true, trim: true, maxlength: 3000 },
      order: { type: Number, default: 0 },
      published: { type: Boolean, default: true },
    },
    opts
  )
);

export const ContactMessage = mongoose.model(
  'ContactMessage',
  new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      email: { type: String, required: true, trim: true, lowercase: true },
      subject: { type: String, trim: true, maxlength: 200 },
      message: { type: String, required: true, trim: true, maxlength: 3000 },
      status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new', index: true },
    },
    opts
  )
);

const auditSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', auditSchema);

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: 'Invertis StudySphere' },
    tagline: { type: String, default: 'Your University. Your Knowledge. Your Future.' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    contactAddress: { type: String, default: '' },
    footerCredit: { type: String, default: 'Developed with innovation by SHOURYA VEXORA.' },
    allowRegistration: { type: Boolean, default: true },
    company: {
      name: { type: String, default: 'SHOURYA VEXORA' },
      tagline: { type: String, default: 'Building Digital Experiences. Creating Future Innovations.' },
      kind: { type: String, default: 'A Technology & Software Development Company.' },
      description: {
        type: String,
        default:
          'SHOURYA VEXORA builds modern digital products and software platforms. Invertis StudySphere is a product proudly developed by SHOURYA VEXORA.',
      },
      founder: { type: String, default: 'Shourya Maheshwari' },
      founderTitle: { type: String, default: 'Founder of SHOURYA VEXORA' },
      website: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      logoUrl: { type: String, default: '' }, // empty = built-in placeholder logo
      portfolio: [{ name: String, description: String, url: String }],
    },
    // role -> permission[]  (Super Admin edits this; null falls back to defaults)
    rolePermissions: { type: Schema.Types.Mixed, default: null },
  },
  opts
);

export const PlatformSettings = mongoose.model('PlatformSettings', settingsSchema);
