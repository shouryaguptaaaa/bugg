// Seeds the *initial* academic structure and categories into the database.
// It is idempotent: running it twice does not create duplicates.
// After this, everything is managed from the admin panel (nothing is hardcoded in the app).
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Course, Branch, Semester, Category, AcademicYear } from '../models/Academic.js';
import { getSettings } from '../utils/settings.js';

const CATEGORIES = [
  'Class Notes', 'Handwritten Notes', 'Previous Year Papers', 'Important Questions', 'Assignments', 'Practical Files',
  'Lab Manuals', 'Lecture PDFs', 'Presentation Slides', 'Reference Books', 'Syllabus', 'Study Guides', 'Other Resources',
];

await mongoose.connect(env.mongoUri);

for (const name of CATEGORIES) {
  if (!(await Category.exists({ name }))) await Category.create({ name });
}

const course = (await Course.findOne({ name: 'B.Tech' })) || (await Course.create({ name: 'B.Tech', code: 'BTECH' }));
const branch =
  (await Branch.findOne({ course: course._id, name: 'Computer Science and Engineering' })) ||
  (await Branch.create({ course: course._id, name: 'Computer Science and Engineering', code: 'CSE' }));
for (let n = 1; n <= 8; n++) {
  if (!(await Semester.exists({ branch: branch._id, number: n }))) await Semester.create({ branch: branch._id, number: n });
}

const now = new Date();
const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const label = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
if (!(await AcademicYear.exists({ label }))) await AcademicYear.create({ label });

await getSettings(true); // creates default platform settings (company branding etc.)

console.log('Seed complete: categories, B.Tech > Computer Science and Engineering > Semester 1-8, academic year', label);
await mongoose.disconnect();
