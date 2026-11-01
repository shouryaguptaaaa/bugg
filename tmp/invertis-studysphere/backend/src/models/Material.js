import mongoose from 'mongoose';

const { Schema } = mongoose;

const fileSchema = new Schema(
  {
    storage: { type: String, enum: ['local', 'cloudinary'], required: true },
    key: { type: String, required: true },
    url: { type: String }, // only set for cloudinary; never sent to clients
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    ext: { type: String, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
  },
  { _id: false }
);

const materialSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    academicYear: { type: String, trim: true, index: true },
    examType: { type: String, enum: ['', 'mid_sem', 'end_sem', 'supplementary', 'other'], default: '', index: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    file: { type: fileSchema, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['draft', 'pending', 'published', 'rejected'], default: 'draft', index: true },
    rejectionReason: { type: String, maxlength: 500 },
    publishAt: { type: Date }, // scheduled publishing: hidden from students until this time
    featured: { type: Boolean, default: false, index: true },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    versions: [
      {
        file: fileSchema,
        replacedAt: { type: Date, default: Date.now },
        replacedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    notifiedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

materialSchema.index({ status: 1, deletedAt: 1, createdAt: -1 });
materialSchema.index({ 'file.hash': 1 });
materialSchema.index({ downloads: -1 });

// Strip internals from API responses
materialSchema.set('toJSON', {
  transform(_doc, ret) {
    if (ret.file) {
      delete ret.file.key;
      delete ret.file.url;
      delete ret.file.hash;
      delete ret.file.storage;
    }
    if (ret.versions) {
      ret.versions = ret.versions.map((v) => ({
        replacedAt: v.replacedAt,
        replacedBy: v.replacedBy,
        note: v.note,
        originalName: v.file?.originalName,
        size: v.file?.size,
      }));
    }
    delete ret.__v;
    return ret;
  },
});

export const Material = mongoose.model('Material', materialSchema);

const downloadSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
downloadSchema.index({ createdAt: -1 });
export const Download = mongoose.model('Download', downloadSchema);

const viewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
viewSchema.index({ createdAt: -1 });
export const View = mongoose.model('View', viewSchema);

const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
bookmarkSchema.index({ user: 1, material: 1 }, { unique: true });
export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

const reportSchema = new Schema(
  {
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 100 },
    details: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
export const Report = mongoose.model('Report', reportSchema);
