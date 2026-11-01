import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Edit3, ExternalLink, FileUp, RotateCcw, Search, Star, Trash2, X } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatBytes, formatDate, useApi, useDebounced, useTitle } from '../../lib/utils';
import type { Material, Paged } from '../../lib/types';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, statusTone, useToast } from '../../components/ui';
import { AcademicSelect, emptyAcademic, type AcademicValue } from '../../components/AcademicSelect';

const TABS = [['', 'All'], ['published', 'Published'], ['pending', 'Pending approval'], ['draft', 'Drafts'], ['rejected', 'Rejected'], ['trash', 'Recycle bin']] as const;

export default function ManageMaterials() {
  useTitle('Manage materials');
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') || '';
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Material | null>(null);
  const [rejecting, setRejecting] = useState<Material | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [bulkCat, setBulkCat] = useState('');

  const qs = new URLSearchParams({ page: String(page), limit: '15' });
  if (tab === 'trash') qs.set('trash', '1'); else if (tab) qs.set('status', tab);
  if (dq) qs.set('q', dq);
  const { data, loading, error, reload } = useApi<Paged<Material>>(`/materials/manage/list?${qs}`);
  const categories = useApi<{ items: any[] }>('/academic/categories');

  const run = async (fn: () => Promise<any>, ok?: string) => {
    try { const r = await fn(); toast.ok(ok || r?.message || 'Done'); setSelected([]); reload(); } catch (e) { toast.err(errMsg(e)); }
  };
  const bulk = (action: string, extra: object = {}) => run(() => api.post('/materials/bulk', { action, ids: selected, ...extra }));

  const toggleAll = () => setSelected(selected.length === data?.items.length ? [] : data?.items.map((m) => m._id) || []);
  const trash = tab === 'trash';

  return (
    <>
      <PageHeader title="Manage materials" subtitle="Edit, approve, replace files, feature and organise study materials." actions={can('materials.upload') ? <Link to="/admin/upload" className="btn-primary"><FileUp className="h-4 w-4" /> Upload</Link> : undefined} />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setParams(v ? { status: v } : {}); setPage(1); setSelected([]); }} className={tab === v ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>{l}</button>)}
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by title..." aria-label="Search materials" className="w-full bg-transparent py-2 text-sm outline-none" /></div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{selected.length} selected</span>
            {!trash && can('materials.delete') && <button className="btn-danger btn-sm" onClick={() => window.confirm(`Move ${selected.length} material(s) to the recycle bin?`) && bulk('delete')}><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
            {trash && can('materials.delete') && <button className="btn-soft btn-sm" onClick={() => bulk('restore')}><RotateCcw className="h-3.5 w-3.5" /> Restore</button>}
            {!trash && can('materials.approve') && <><button className="btn-soft btn-sm" onClick={() => bulk('publish')}>Publish</button><button className="btn-outline btn-sm" onClick={() => bulk('unpublish')}>Unpublish</button></>}
            {!trash && can('materials.edit') && (
              <span className="flex items-center gap-1">
                <select className="input !w-auto !py-1.5 text-xs" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} aria-label="Bulk category"><option value="">Set category...</option>{categories.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
                <button className="btn-outline btn-sm" disabled={!bulkCat} onClick={() => bulk('categorize', { category: bulkCat })}>Apply</button>
              </span>
            )}
          </div>
        )}
      </div>

      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? (
        <EmptyState title={trash ? 'Recycle bin is empty' : 'No materials found'} text={trash ? 'Deleted materials are kept here for 30 days before being removed permanently.' : 'Upload materials or change the filters.'} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-100 bg-slate-50"><tr>
                <th className="th w-10"><input type="checkbox" aria-label="Select all" checked={selected.length === data.items.length} onChange={toggleAll} /></th>
                <th className="th">Title</th><th className="th">Subject</th><th className="th">Status</th><th className="th">Stats</th><th className="th">Uploaded</th><th className="th text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/60">
                    <td className="td"><input type="checkbox" aria-label={`Select ${m.title}`} checked={selected.includes(m._id)} onChange={(e) => setSelected(e.target.checked ? [...selected, m._id] : selected.filter((x) => x !== m._id))} /></td>
                    <td className="td max-w-[280px]"><p className="truncate font-medium">{m.featured && <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}{m.title}</p><p className="truncate text-xs text-slate-400">{m.category?.name} · {m.file.ext.slice(1).toUpperCase()} · {formatBytes(m.file.size)}{m.versions && m.versions.length > 0 ? ` · v${m.versions.length + 1}` : ''}</p></td>
                    <td className="td text-slate-500">{m.subject?.name}<p className="text-xs">{m.semester?.name}</p></td>
                    <td className="td"><Badge tone={statusTone(m.status) as any}>{m.status}</Badge>{m.publishAt && new Date(m.publishAt) > new Date() && <p className="mt-1 text-[11px] text-amber-600">Scheduled {formatDate(m.publishAt)}</p>}</td>
                    <td className="td text-xs text-slate-500">{m.views} views<br />{m.downloads} downloads</td>
                    <td className="td text-xs text-slate-500">{formatDate(m.createdAt)}<br />{m.uploadedBy?.name}</td>
                    <td className="td"><div className="flex flex-wrap justify-end gap-1.5">
                      {!trash && m.status === 'pending' && can('materials.approve') && <><button title="Approve" aria-label="Approve" className="btn-soft btn-sm" onClick={() => run(() => api.post(`/materials/${m._id}/approve`))}><Check className="h-3.5 w-3.5" /></button><button title="Reject" aria-label="Reject" className="btn-outline btn-sm" onClick={() => { setRejecting(m); setRejectReason(''); }}><X className="h-3.5 w-3.5" /></button></>}
                      {!trash && <Link title="Open" aria-label="Open public page" to={`/materials/${m._id}`} className="btn-outline btn-sm"><ExternalLink className="h-3.5 w-3.5" /></Link>}
                      {!trash && can('materials.edit') && <button title="Edit" aria-label="Edit" className="btn-outline btn-sm" onClick={() => setEditing(m)}><Edit3 className="h-3.5 w-3.5" /></button>}
                      {!trash && can('materials.delete') && <button title="Delete" aria-label="Delete" className="btn-outline btn-sm text-red-600" onClick={() => window.confirm('Move to recycle bin?') && run(() => api.del(`/materials/${m._id}`))}><Trash2 className="h-3.5 w-3.5" /></button>}
                      {trash && can('materials.delete') && <><button className="btn-soft btn-sm" onClick={() => run(() => api.post(`/materials/${m._id}/restore`))}><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                        <button className="btn-outline btn-sm text-red-600" onClick={() => window.confirm('Permanently delete this file? This cannot be undone.') && run(() => api.del(`/materials/${m._id}/permanent`))}>Delete forever</button></>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}

      {editing && <EditModal material={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}

      <Modal open={Boolean(rejecting)} title="Reject material" onClose={() => setRejecting(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">"{rejecting?.title}"</p>
          <Field label="Reason (shown to the uploader)"><textarea className="input min-h-24" maxLength={500} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setRejecting(null)}>Cancel</button><button className="btn-danger" onClick={async () => { const id = rejecting!._id; setRejecting(null); await run(() => api.post(`/materials/${id}/reject`, { reason: rejectReason })); }}>Reject</button></div>
        </div>
      </Modal>
    </>
  );
}

function EditModal({ material: m, onClose, onSaved }: { material: Material; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [form, setForm] = useState({
    title: m.title, description: m.description, category: m.category?._id || '', academicYear: m.academicYear || '', examType: (m as any).examType || '', tags: m.tags.join(', '),
    status: m.status === 'draft' ? 'draft' : 'published', featured: m.featured, publishAt: m.publishAt ? new Date(new Date(m.publishAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
  });
  const [ac, setAc] = useState<AcademicValue>({ ...emptyAcademic, subject: m.subject?._id || '', module: m.module?._id || '', semester: m.semester?._id || '', branch: m.branch?._id || '', course: m.course?._id || '' });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const replace = useRef<HTMLInputElement>(null);
  const categories = useApi<{ items: any[] }>('/academic/categories');
  const years = useApi<{ items: any[] }>('/academic/academic-years');

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/materials/${m._id}`, {
        title: form.title, description: form.description, category: form.category, academicYear: form.academicYear, examType: form.examType, tags: form.tags,
        subject: ac.subject, module: ac.module, status: form.status, publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : '',
        ...(can('materials.approve') ? { featured: form.featured } : {}),
      });
      toast.ok('Material updated'); onSaved();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  const replaceFile = async (f?: File) => {
    if (!f) return;
    const fd = new FormData(); fd.append('file', f); fd.append('note', note);
    setProgress(0);
    try { await api.upload(`/materials/${m._id}/file`, fd, setProgress, 'PUT'); toast.ok('File replaced. The previous file is kept in version history.'); onSaved(); } catch (e) { toast.err(errMsg(e)); } finally { setProgress(null); if (replace.current) replace.current.value = ''; }
  };

  return (
    <Modal open title="Edit material" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Title"><input className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input min-h-20" value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <AcademicSelect value={ac} onChange={setAc} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
          <Field label="Academic year"><select className="input" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })}><option value="">Not specified</option>{years.data?.items.map((y) => <option key={y._id} value={y.label}>{y.label}</option>)}</select></Field>
<Field label="Exam type (for question papers)"><select className="input" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}><option value="">Not applicable</option><option value="mid_sem">Mid semester</option><option value="end_sem">End semester</option><option value="supplementary">Supplementary</option><option value="other">Other</option></select></Field>
              <Field label="Tags"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <Field label="Schedule publishing"><input type="datetime-local" className="input" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} /></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="published">{can('materials.approve') ? 'Published' : 'Submit for approval'}</option><option value="draft">Draft</option></select></Field>
          {can('materials.approve') && <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured on homepage</label>}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold">Replace file</p>
          <p className="mb-3 text-xs text-slate-500">Current: {m.file.originalName} ({formatBytes(m.file.size)}). The old file stays in version history.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input flex-1" placeholder="What changed? (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-outline" disabled={progress !== null} onClick={() => replace.current?.click()}><FileUp className="h-4 w-4" /> {progress !== null ? `${progress}%` : 'Choose new file'}</button>
            <input ref={replace} type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.mp4" onChange={(e) => replaceFile(e.target.files?.[0])} />
          </div>
          {m.versions && m.versions.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-500">{[...m.versions].reverse().map((v, i) => <li key={i}>v{m.versions!.length - i}: {v.originalName} · replaced {formatDate(v.replacedAt)}</li>)}</ul>}
        </div>

        <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || form.title.trim().length < 2} onClick={save}>Save changes</button></div>
      </div>
    </Modal>
  );
}
