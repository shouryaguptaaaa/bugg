import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Download, FileUp, Paperclip } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, formatBytes, formatDateTime, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, PageHeader, PageLoader, useToast } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' }> = {
  pending: { label: 'Pending', tone: 'amber' }, overdue: { label: 'Overdue', tone: 'red' }, submitted: { label: 'Submitted', tone: 'blue' }, submitted_late: { label: 'Submitted late', tone: 'amber' }, reviewed: { label: 'Graded', tone: 'green' },
};

export function Assignments() {
  useTitle('Assignments');
  const [filter, setFilter] = useState('');
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/assignments');
  const items = (data?.items || []).filter((a) => !filter || (filter === 'open' ? ['pending', 'overdue'].includes(a.status) : !['pending', 'overdue'].includes(a.status)));
  return (
    <>
      <PageHeader title="Assignments" subtitle="Download assignments, submit your work and track grades." actions={
        <select className="input !w-auto" aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All assignments</option><option value="open">To do</option><option value="done">Submitted / graded</option></select>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (items.length === 0 ? <EmptyState title="No assignments" text="Assignments posted by your instructors appear here." /> : (
        <div className="grid gap-4 md:grid-cols-2">{items.map((a) => (
          <Link key={a._id} to={`/assignments/${a._id}`} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>{a.subject && <Badge>{a.subject.name}</Badge>}</div>
            <h3 className="font-bold">{a.title}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><CalendarClock className="h-4 w-4" /> Due {formatDateTime(a.dueDate)}</p>
            {a.submission?.status === 'reviewed' && <p className="mt-1 text-sm font-semibold text-emerald-600">Score: {a.submission.marks} / {a.maxMarks}</p>}
          </Link>))}</div>))}
    </>
  );
}

export function AssignmentDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ assignment: any; submission: any }>(`/assignments/${id}`);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  useTitle(data?.assignment.title || 'Assignment');
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'Not found'} onRetry={reload} />;
  const { assignment: a, submission: s } = data;
  const overdue = new Date(a.dueDate).getTime() < Date.now();
  const locked = s?.status === 'reviewed' || (overdue && !a.allowLate);

  const submit = async () => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('note', note);
    setPct(0);
    try { const r = await api.upload(`/assignments/${id}/submit`, fd, setPct); toast.ok(r.message); setFile(null); setNote(''); reload(); } catch (e) { toast.err(errMsg(e)); } finally { setPct(null); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/assignments" className="text-sm font-semibold text-brand">&larr; All assignments</Link>
      <div className="card mt-3 p-6">
        <div className="mb-2 flex flex-wrap gap-2">{a.subject && <Badge tone="blue">{a.subject.name}</Badge>}<Badge tone={overdue ? 'red' : 'amber'}>Due {formatDateTime(a.dueDate)}</Badge><Badge>{a.maxMarks} marks</Badge>{!a.allowLate && <Badge tone="red">No late submissions</Badge>}</div>
        <h1 className="text-2xl font-bold">{a.title}</h1>
        {a.description && <p className="mt-3 whitespace-pre-line text-slate-600">{a.description}</p>}
        {a.referenceFile && <a className="btn-outline mt-4" href={api.url(`/assignments/${id}/reference`)}><Download className="h-4 w-4" /> Reference: {a.referenceFile.originalName} ({formatBytes(a.referenceFile.size)})</a>}
      </div>

      {s && (
        <div className="card mt-4 p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="font-bold">Your submission</h2><Badge tone={STATUS[s.status === 'reviewed' ? 'reviewed' : s.late ? 'submitted_late' : 'submitted'].tone}>{STATUS[s.status === 'reviewed' ? 'reviewed' : s.late ? 'submitted_late' : 'submitted'].label}</Badge></div>
          <a className="inline-flex items-center gap-2 text-sm font-medium text-brand" href={api.url(`/assignments/submissions/${s._id}/file`)}><Paperclip className="h-4 w-4" />{s.file.originalName} ({formatBytes(s.file.size)})</a>
          <p className="text-xs text-slate-500">Submitted {formatDateTime(s.submittedAt)}</p>
          {s.note && <p className="mt-2 text-sm text-slate-600">Note: {s.note}</p>}
          {s.status === 'reviewed' && <div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="font-bold text-emerald-700">Score: {s.marks} / {a.maxMarks}</p>{s.feedback && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">Feedback: {s.feedback}</p>}</div>}
          {s.history?.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Submission history ({s.history.length} earlier)</summary><ul className="mt-2 space-y-1">{s.history.map((h: any, i: number) => <li key={i}><a className="text-brand" href={api.url(`/assignments/submissions/${s._id}/file?v=${i}`)}>{h.file.originalName}</a> <span className="text-slate-500">· {formatDateTime(h.submittedAt)}{h.late ? ' · late' : ''}</span></li>)}</ul></details>}
        </div>)}

      {!locked ? (
        <div className="card mt-4 space-y-4 p-6">
          <h2 className="font-bold">{s ? 'Replace your submission' : 'Submit your work'}</h2>
          {overdue && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">The deadline has passed. Your submission will be marked as late.</p>}
          <Field label="File" hint="PDF, Word, PowerPoint, Excel, ZIP or image."><input type="file" className="input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
          <Field label="Note for the instructor (optional)"><textarea className="input" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          {pct !== null && <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct}><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>}
          <button className={cx('btn-primary')} disabled={!file || pct !== null} onClick={submit}><FileUp className="h-4 w-4" /> {pct !== null ? `Uploading ${pct}%` : 'Submit'}</button>
        </div>
      ) : <p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{s?.status === 'reviewed' ? 'This submission has been graded and is now locked.' : 'Submissions are closed for this assignment.'}</p>}
    </div>
  );
}
