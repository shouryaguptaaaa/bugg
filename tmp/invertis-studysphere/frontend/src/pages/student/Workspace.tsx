import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, NotebookPen, Pin, Plus, Trash2, X } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, formatDate, useApi, useDebounced, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, useToast } from '../../components/ui';

type Tab = 'notes' | 'folders' | 'progress';

export default function Workspace() {
  useTitle('My workspace');
  const [tab, setTab] = useState<Tab>('notes');
  return (
    <>
      <PageHeader title="My study workspace" subtitle="Your private notes, study folders and reading progress. Only you can see this." />
      <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">{([['notes', 'Notes'], ['folders', 'Folders & collections'], ['progress', 'Reading progress']] as const).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('rounded-lg px-4 py-2 text-sm font-semibold', tab === k ? 'bg-white shadow-sm' : 'text-slate-500')}>{l}</button>))}</div>
      {tab === 'notes' && <Notes />}
      {tab === 'folders' && <Folders />}
      {tab === 'progress' && <Progress />}
    </>
  );
}

function Notes() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const dq = useDebounced(q);
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const qs = new URLSearchParams(); if (dq) qs.set('q', dq); if (subject) qs.set('subject', subject);
  const { data, loading, error, reload } = useApi<{ items: any[] }>(`/me/notes?${qs}`);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', body: '', subject: '', pinned: false });
  const [busy, setBusy] = useState(false);
  const openNew = () => { setEditing(null); setF({ title: '', body: '', subject: '', pinned: false }); setOpen(true); };
  const openEdit = (n: any) => { setEditing(n); setF({ title: n.title, body: n.body, subject: n.subject?._id || '', pinned: n.pinned }); setOpen(true); };
  const save = async () => {
    setBusy(true);
    try { if (editing) await api.patch(`/me/notes/${editing._id}`, f); else await api.post('/me/notes', f); toast.ok('Note saved'); setOpen(false); reload(); } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const del = async () => { if (!editing || !window.confirm('Delete this note?')) return; try { await api.del(`/me/notes/${editing._id}`); setOpen(false); reload(); } catch (e) { toast.err(errMsg(e)); } };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input !w-56" placeholder="Search notes..." aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-auto" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All subjects</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
        <button className="btn-primary ml-auto" onClick={openNew}><Plus className="h-4 w-4" /> New note</button>
      </div>
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState icon={<NotebookPen className="h-6 w-6" />} title="No notes yet" action={<button className="btn-primary" onClick={openNew}>Write your first note</button>} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((n) => (
          <button key={n._id} onClick={() => openEdit(n)} className="card p-5 text-left transition hover:shadow-lift">
            <div className="mb-1 flex items-center gap-2">{n.pinned && <Pin className="h-3.5 w-3.5 text-brand" />}<h3 className="truncate font-semibold">{n.title}</h3></div>
            <p className="line-clamp-4 whitespace-pre-line text-sm text-slate-600">{n.body || 'Empty note'}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">{n.subject && <Badge tone="blue">{n.subject.name}</Badge>}{formatDate(n.updatedAt)}</p></button>))}</div>))}
      <Modal open={open} title={editing ? 'Edit note' : 'New note'} onClose={() => setOpen(false)} wide>
        <div className="space-y-4">
          <Field label="Title"><input className="input" maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Subject (optional)"><select className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option value="">No subject</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
          <Field label="Note"><textarea className="input min-h-[200px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to top</label>
          <div className="flex justify-between gap-2">{editing ? <button className="btn-outline text-red-600" onClick={del}><Trash2 className="h-4 w-4" /> Delete</button> : <span />}<div className="flex gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || !f.title.trim()} onClick={save}>Save</button></div></div>
        </div>
      </Modal>
    </>
  );
}

function Folders() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/me/folders');
  const [name, setName] = useState('');
  const act = async (fn: () => Promise<any>) => { try { await fn(); reload(); } catch (e) { toast.err(errMsg(e)); } };
  return (
    <>
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) act(async () => { await api.post('/me/folders', { name }); setName(''); }); }}>
        <input className="input" placeholder="New folder name, e.g. Exam revision" aria-label="Folder name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" disabled={!name.trim()}><FolderPlus className="h-4 w-4" /> Create</button></form>
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No folders yet" text="Create a folder, then use “Save to folder” on any material page." /> : (
        <div className="grid gap-4 md:grid-cols-2">{data.items.map((f) => (
          <div key={f._id} className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold">{f.name} <span className="text-xs font-normal text-slate-400">({f.materials.length})</span></h3>
              <button className="text-slate-400 hover:text-red-600" aria-label="Delete folder" onClick={() => window.confirm(`Delete folder "${f.name}"? The materials themselves are not deleted.`) && act(() => api.del(`/me/folders/${f._id}`))}><Trash2 className="h-4 w-4" /></button></div>
            {f.materials.length === 0 ? <p className="text-sm text-slate-500">Empty</p> : <ul className="space-y-1.5">{f.materials.filter((m: any) => m && !m.deletedAt && m.status === 'published').map((m: any) => (
              <li key={m._id} className="flex items-center justify-between gap-2 text-sm"><Link className="truncate font-medium text-brand" to={`/materials/${m._id}`}>{m.title}</Link><button className="text-slate-300 hover:text-red-600" aria-label="Remove from folder" onClick={() => act(() => api.del(`/me/folders/${f._id}/materials/${m._id}`))}><X className="h-3.5 w-3.5" /></button></li>))}</ul>}
          </div>))}</div>))}
    </>
  );
}

function Progress() {
  const { data, loading, error, reload } = useApi<{ items: any[]; completed: number; inProgress: number }>('/me/progress');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.items.length) return <EmptyState title="No reading progress yet" text="Open a material and update your progress to track what you have read." />;
  return (
    <>
      <p className="mb-4 text-sm text-slate-500">{data.completed} completed · {data.inProgress} in progress</p>
      <div className="card divide-y divide-slate-100">{data.items.map((p) => (
        <Link key={p._id} to={`/materials/${p.material._id}`} className="block p-4 hover:bg-slate-50">
          <div className="flex justify-between gap-3 text-sm"><span className="truncate font-medium">{p.material.title}</span><span className="shrink-0 text-slate-500">{p.percent}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={cx('h-2 rounded-full', p.percent >= 100 ? 'bg-emerald-500' : 'bg-brand')} style={{ width: `${p.percent}%` }} /></div>
          <p className="mt-1 text-xs text-slate-400">{p.material.subject?.name} · last opened {formatDate(p.updatedAt)}</p></Link>))}</div>
    </>
  );
}
