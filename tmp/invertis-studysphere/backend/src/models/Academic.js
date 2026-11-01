import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

// University -> Course -> Branch -> Semester -> Subject -> Module -> Material
// (the university itself is the platform; it has no collection of its own)

export const Course = mongoose.model(
  'Course',
  new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
      code: { type: String, trim: true, uppercase: true, maxlength: 20 },
      active: { type: Boolean, default: true },
    },
    opts
  )
);

const branchSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
  },
  opts
);
branchSchema.index({ course: 1, name: 1 }, { unique: true });
export const Branch = mongoose.model('Branch', branchSchema);

const semesterSchema = new Schema(
  {
    branch: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    number: { type: Number, required: true, min: 1, max: 20 },
    name: { type: String, trim: true, maxlength: 60 },
  },
  opts
);
semesterSchema.index({ branch: 1, number: 1 }, { unique: true });
semesterSchema.pre('validate', function (next) {
  if (!this.name) this.name = `Semester ${this.number}`;
  next();
});
export const Semester = mongoose.model('Semester', semesterSchema);

const subjectSchema = new Schema(
  {
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, trim: true, uppercase: true, maxlength: 30 },
  },
  opts
);
subjectSchema.index({ semester: 1, name: 1 }, { unique: true });
subjectSchema.index({ name: 'text', code: 'text' });
export const Subject = mongoose.model('Subject', subjectSchema);

const moduleSchema = new Schema(
  {
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    order: { type: Number, default: 0 },
  },
  opts
);
moduleSchema.index({ subject: 1, name: 1 }, { unique: true });
export const Module = mongoose.model('Module', moduleSchema);

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true, maxlength: 300 },
  },
  opts
);
categorySchema.pre('validate', function (next) {
  if (this.name) this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  next();
});
export const Category = mongoose.model('Category', categorySchema);

export const AcademicYear = mongoose.model(
  'AcademicYear',
  new Schema({ label: { type: String, required: true, trim: true, unique: true, maxlength: 20 } }, opts)
);
