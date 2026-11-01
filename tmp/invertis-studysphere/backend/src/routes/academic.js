import { Router } from 'express';
import { z } from 'zod';
import { Course, Branch, Semester, Subject, Module, Category, AcademicYear } from '../models/Academic.js';
import { Material } from '../models/Material.js';
import { authenticate, can } from '../middleware/auth.js';
import { ah, ApiError, audit, isId } from '../utils/helpers.js';

const router = Router();

const str = (max = 150) => z.string().trim().min(1, 'This field is required').max(max);
const opt = (max = 30) => z.string().trim().max(max).optional().or(z.literal(''));

// One config entry per level of the hierarchy. Nothing academic is hardcoded - admins create it all.
const kinds = {
  courses: {
    model: Course,
    parent: null,
    schema: z.object({ name: str(120), code: opt(20), active: z.boolean().optional() }),
    children: [{ model: Branch, filter: (d) => ({ course: d._id }), label: 'branches' }],
  },
  branches: {
    model: Branch,
    parent: 'course',
    schema: z.object({ course: str(30), name: str(120), code: opt(20) }),
    populate: 'course',
    children: [{ model: Semester, filter: (d) => ({ branch: d._id }), label: 'semesters' }],
  },
  semesters: {
    model: Semester,
    parent: 'branch',
    schema: z.object({ branch: str(30), number: z.coerce.number().int().min(1).max(20), name: opt(60) }),
    populate: { path: 'branch', populate: 'course' },
    sort: { number: 1 },
    children: [{ model: Subject, filter: (d) => ({ semester: d._id }), label: 'subjects' }],
  },
  subjects: {
    model: Subject,
    parent: 'semester',
    schema: z.object({ semester: str(30), name: str(150), code: opt(30) }),
    populate: { path: 'semester', populate: { path: 'branch', populate: 'course' } },
    sort: { name: 1 },
    children: [
      { model: Module, filter: (d) => ({ subject: d._id }), label: 'modules' },
      { model: Material, filter: (d) => ({ subject: d._id }), label: 'materials' },
    ],
  },
  modules: {
    model: Module,
    parent: 'subject',
    schema: z.object({ subject: str(30), name: str(150), order: z.coerce.number().int().min(0).max(999).optional() }),
    populate: 'subject',
    sort: { order: 1, name: 1 },
    children: [{ model: Material, filter: (d) => ({ module: d._id }), label: 'materials' }],
  },
  categories: {
    model: Category,
    parent: null,
    schema: z.object({ name: str(80), description: opt(300) }),
    sort: { name: 1 },
    children: [{ model: Material, filter: (d) => ({ category: d._id }), label: 'materials' }],
  },
  'academic-years': {
    model: AcademicYear,
    parent: null,
    schema: z.object({ label: str(20) }),
    sort: { label: -1 },
    children: [{ model: Material, filter: (d) => ({ academicYear: d.label }), label: 'materials' }],
  },
};

function getKind(req) {
  const k = kinds[req.params.kind];
  if (!k) throw new ApiError(404, 'Unknown academic resource');
  return k;
}

// Public read: used for filters, browsing, and admin dropdowns
router.get(
  '/:kind',
  ah(async (req, res) => {
    const k = getKind(req);
    const filter = {};
    if (k.parent && req.query.parent) {
      if (!isId(String(req.query.parent))) throw new ApiError(400, 'Invalid parent');
      filter[k.parent] = req.query.parent;
    }
    let q = k.model.find(filter).sort(k.sort || { createdAt: 1 }).limit(1000);
    if (k.populate) q = q.populate(k.populate);
    res.json({ items: await q });
  })
);

router.post(
  '/:kind',
  authenticate,
  can('academic.manage'),
  ah(async (req, res) => {
    const k = getKind(req);
    const data = k.schema.parse(req.body);
    if (k.parent) {
      const Parent = { course: Course, branch: Branch, semester: Semester, subject: Subject }[k.parent];
      if (!isId(data[k.parent]) || !(await Parent.exists({ _id: data[k.parent] }))) throw new ApiError(400, `Choose a valid ${k.parent}`);
    }
    const doc = await k.model.create(data);
    await audit(req, `academic.${req.params.kind}.create`, k.model.modelName, doc._id, data);
    res.status(201).json(doc);
  })
);

router.patch(
  '/:kind/:id',
  authenticate,
  can('academic.manage'),
  ah(async (req, res) => {
    const k = getKind(req);
    const data = k.schema.partial().parse(req.body);
    const doc = await k.model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Not found');
    Object.assign(doc, data);
    await doc.save();
    await audit(req, `academic.${req.params.kind}.update`, k.model.modelName, doc._id, data);
    res.json(doc);
  })
);

router.delete(
  '/:kind/:id',
  authenticate,
  can('academic.manage'),
  ah(async (req, res) => {
    const k = getKind(req);
    const doc = await k.model.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Not found');
    // Protect data integrity: refuse to delete anything that still has children or materials
    for (const c of k.children) {
      const n = await c.model.countDocuments(c.filter(doc));
      if (n > 0) throw new ApiError(409, `Cannot delete: ${n} ${c.label} still belong to this item. Remove or move them first.`);
    }
    await doc.deleteOne();
    await audit(req, `academic.${req.params.kind}.delete`, k.model.modelName, doc._id);
    res.json({ message: 'Deleted' });
  })
);

export default router;
