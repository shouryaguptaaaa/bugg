import { Material } from '../models/Material.js';
import { Assignment, Submission } from '../models/Learning.js';
import { StudyPlan } from '../models/Personal.js';
import { User } from '../models/User.js';
import { notify } from './notify.js';

const live = () => ({ deletedAt: null, status: 'published', $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] });

/** Tells students about materials that just became visible (direct publish, approval or scheduled publishing). */
export async function sweepMaterials() {
  const fresh = await Material.find({ ...live(), notifiedAt: null, updatedAt: { $gte: new Date(Date.now() - 2 * 86400000) } })
    .select('title subject')
    .populate('subject', 'name')
    .limit(100);
  if (!fresh.length) return;
  await Material.updateMany({ _id: { $in: fresh.map((m) => m._id) } }, { notifiedAt: new Date() });
  if (fresh.length > 5) {
    await notify({ role: 'student' }, { type: 'material', title: `${fresh.length} new study materials added`, body: 'Open the Study Library to see what is new.', link: '/library?sort=newest' });
  } else {
    for (const m of fresh) await notify({ role: 'student' }, { type: 'material', title: `New material: ${m.title}`, body: m.subject?.name || '', link: `/materials/${m._id}` });
  }
}

/** Assignment deadline reminders: due within 24 hours, sent once, only to students who have not submitted. */
export async function sweepDeadlines() {
  const soon = await Assignment.find({ published: true, deadlineNotified: false, dueDate: { $gt: new Date(), $lte: new Date(Date.now() + 24 * 3600 * 1000) } });
  for (const a of soon) {
    a.deadlineNotified = true;
    await a.save();
    const submitted = await Submission.find({ assignment: a._id }).distinct('student');
    const pending = await User.find({ role: 'student', status: 'active', _id: { $nin: submitted } }).distinct('_id');
    if (pending.length) await notify(pending, { type: 'assignment', title: `Deadline soon: ${a.title}`, body: `Due ${a.dueDate.toLocaleString('en-IN')}`, link: `/assignments/${a._id}` });
  }
}

/** Study planner reminders set by students. */
export async function sweepReminders() {
  const due = await StudyPlan.find({ reminderAt: { $lte: new Date() }, reminderSent: false, done: false }).limit(200);
  for (const p of due) {
    p.reminderSent = true;
    await p.save();
    await notify([p.user], { type: 'account', title: `Reminder: ${p.title}`, body: p.notes || '', link: '/planner' });
  }
}

export function startJobs() {
  const run = (fn) => fn().catch((e) => console.error(`Job ${fn.name} failed:`, e.message));
  const tick = () => [sweepMaterials, sweepDeadlines, sweepReminders].forEach(run);
  setTimeout(tick, 5000).unref();
  setInterval(tick, 60 * 1000).unref();
}
