import { useState } from 'react';
import { Edit3, Plus, Trash2, Users } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { formatBytes, formatDateTime, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, useToast } from '../../components/ui';

const toLocal = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const blank = { title: '', description: '', subject: '', dueDate: '', maxMarks: 10, allowLate: true, published: true };

export default function ManageAssignments() {
  useTitle('Manage assignments');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/assignments/manage/list');
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<any>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [subs, setSubs] = useState<any | null>(null);

  const openNew = () => { setEditing(null); setF(blank); setFile(null); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setF({ title: a.title, description: a.description || '', subject: a.subject?._id || '', dueDate: toLocal(a.dueDate), maxMarks: a.maxMarks, allowLate: a.allowLate, published: a.published }); setFile(null); setOpen(true); };
  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries({ ...f, dueDate: new Date(f.dueDate).toISOString() }).forEach(([k, v]) => fd.append(k, String(v)));
      if (file) fd.append('reference', file);
      await api.upload(editing ? `/assignments/${editing._id}` : '/assignments', fd, undefined, editing ? 'PATCH' : 'POST');
      toast.ok('Assignment saved'); setOpen(false); reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const del = async (a: any) => { if (!window.confirm(`Delete "${a.title}" and all submissions?`)) return; try { await api.del(`/assignments/${a._id}`); toast.ok('Deleted'); reload(); } catch (e) { toast.err(errMsg(e)); } };

  return (
    <>
      <PageHeader title="Assignments" subtitle="Post assignments with deadlines, then review and grade student submissions." actions={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> New assignment</button>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No assignments yet" action={<button className="btn-primary" onClick={openNew}>Create one</button>} /> : (
        <div className="card divide-y divide-slate-100">{data.items.map((a) => (
          <div key={a._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{a.title}</p><Badge tone={a.published ? 'green' : 'slate'}>{a.published ? 'Published' : 'Draft'}</Badge></div>
              <p className="text-xs text-slate-500">{a.subject?.name} · due {formatDateTime(a.dueDate)} · {a.maxMarks} marks · {a.submissionCount} submitted, {a.reviewedCount} graded</p></div>
            <div className="flex gap-1.5"><button className="btn-soft btn-sm" onClick={() => setSubs(a)}><Users className="h-3.5 w-3.5" /> Submissions</button>
              <button className="btn-outline btn-sm" onClick={() => openEdit(a)} aria-label="Edit"><Edit3 className="h-3.5 w-3.5" /></button><button className="btn-outline btn-sm text-red-600" onClick={() => del(a)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div>
          </div>))}</div>))}

      <Modal open={open} title={editing ? 'Edit assignment' : 'New assignment'} onClose={() => setOpen(false)} wide>
        <div className="space-y-4">
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description"><textarea className="input" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Subject"><select className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option value="">Select</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <Field label="Due date & time"><input type="datetime-local" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
            <Field label="Maximum marks"><input type="number" min={1} className="input" value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} /></Field>
          </div>
          <Field label="Reference document (optional)" hint={editing?.referenceFile ? `Current: ${editing.referenceFile.originalName}. Choose a file to replace it.` : undefined}><input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
          <div className="flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={f.allowLate} onChange={(e) => setF({ ...f, allowLate: e.target.checked })} /> Accept late submissions</label><label className="flex items-center gap-2"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published (students are notified)</label></div>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || f.title.trim().length < 3 || !f.subject || !f.dueDate} onClick={save}>Save</button></div>
        </div>
      </Modal>
      {subs && <Submissions assignment={subs} onClose={() => { setSubs(null); reload(); }} />}
    </>
  );
}

function Submissions({ assignment, onClose }: { assignment: any; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: any[]; assignment: any }>(`/assignments/${assignment._id}/submissions?limit=100`);
  const [grade, setGrade] = useState<Record<string, { marks: string; feedback: string }>>({});
  const save = async (s: any) => {
    const g = grade[s._id] || { marks: String(s.marks ?? ''), feedback: s.feedback || '' };
    try { await api.patch(`/assignments/submissions/${s._id}/review`, { marks: Number(g.marks), feedback: g.feedback }); toast.ok('Graded and student notified'); reload(); } catch (e) { toast.err(errMsg(e)); }
  };
  return (
    <Modal open title={`Submissions: ${assignment.title}`} onClose={onClose} wide>
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <p className="text-sm text-slate-500">No submissions yet.</p> : (
        <div className="space-y-3">{data.items.map((s) => { const g = grade[s._id] || { marks: String(s.marks ?? ''), feedback: s.feedback || '' }; return (
          <div key={s._id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{s.student?.name}</p><span className="text-xs text-slate-500">{s.student?.enrollmentNo || s.student?.email}</span>{s.late && <Badge tone="amber">Late</Badge>}<Badge tone={s.status === 'reviewed' ? 'green' : 'blue'}>{s.status === 'reviewed' ? 'Graded' : 'Awaiting review'}</Badge></div>
            <p className="mt-1 text-sm"><a className="font-medium text-brand" href={api.url(`/assignments/submissions/${s._id}/file`)}>{s.file.originalName}</a> <span className="text-xs text-slate-500">({formatBytes(s.file.size)}) · {formatDateTime(s.submittedAt)}{s.history?.length ? ` · ${s.history.length} earlier version(s)` : ''}</span></p>
            {s.note && <p className="text-sm text-slate-600">Student note: {s.note}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
              <input type="number" min={0} max={data.assignment?.maxMarks} className="input" placeholder={`/ ${data.assignment?.maxMarks}`} aria-label="Marks" value={g.marks} onChange={(e) => setGrade({ ...grade, [s._id]: { ...g, marks: e.target.value } })} />
              <input className="input" placeholder="Feedback for the student" aria-label="Feedback" value={g.feedback} onChange={(e) => setGrade({ ...grade, [s._id]: { ...g, feedback: e.target.value } })} />
              <button className="btn-primary" disabled={g.marks === ''} onClick={() => save(s)}>{s.status === 'reviewed' ? 'Update' : 'Grade'}</button></div>
          </div>); })}</div>))}
    </Modal>
  );
}
