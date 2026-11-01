import { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useApi, useTitle } from '../../lib/utils';
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, useToast } from '../../components/ui';

type Kind = 'courses' | 'branches' | 'semesters' | 'subjects' | 'modules' | 'categories' | 'academic-years';

interface Cfg {
  title: string;
  singular: string;
  parent?: { kind: Kind; key: string; label: string };
  fields: { key: string; label: string; type?: 'text' | 'number'; required?: boolean }[];
  describe: (i: any) => { name: string; sub?: string };
}

const CFG: Record<Kind, Cfg> = {
  courses: { title: 'Courses', singular: 'course', fields: [{ key: 'name', label: 'Course name', required: true }, { key: 'code', label: 'Code (optional)' }], describe: (i) => ({ name: i.name, sub: i.code }) },
  branches: { title: 'Branches', singular: 'branch', parent: { kind: 'courses', key: 'course', label: 'Course' }, fields: [{ key: 'name', label: 'Branch name', required: true }, { key: 'code', label: 'Code (optional)' }], describe: (i) => ({ name: i.name, sub: `${i.course?.name || ''}${i.code ? ` · ${i.code}` : ''}` }) },
  semesters: { title: 'Semesters', singular: 'semester', parent: { kind: 'branches', key: 'branch', label: 'Branch' }, fields: [{ key: 'number', label: 'Semester number', type: 'number', required: true }, { key: 'name', label: 'Display name (optional)' }], describe: (i) => ({ name: i.name, sub: `${i.branch?.course?.name || ''} · ${i.branch?.name || ''}` }) },
  subjects: { title: 'Subjects', singular: 'subject', parent: { kind: 'semesters', key: 'semester', label: 'Semester' }, fields: [{ key: 'name', label: 'Subject name', required: true }, { key: 'code', label: 'Subject code (optional)' }], describe: (i) => ({ name: i.name, sub: `${i.semester?.branch?.course?.name || ''} · ${i.semester?.branch?.name || ''} · ${i.semester?.name || ''}${i.code ? ` · ${i.code}` : ''}` }) },
  modules: { title: 'Modules', singular: 'module', parent: { kind: 'subjects', key: 'subject', label: 'Subject' }, fields: [{ key: 'name', label: 'Module name', required: true }, { key: 'order', label: 'Order (0 first)', type: 'number' }], describe: (i) => ({ name: i.name, sub: i.subject?.name }) },
  categories: { title: 'Categories', singular: 'category', fields: [{ key: 'name', label: 'Category name', required: true }, { key: 'description', label: 'Description (optional)' }], describe: (i) => ({ name: i.name, sub: i.description }) },
  'academic-years': { title: 'Academic years', singular: 'academic year', fields: [{ key: 'label', label: 'Label, e.g. 2025-26', required: true }], describe: (i) => ({ name: i.label }) },
};

/** Label used in parent dropdown. Includes ancestry so identically named items stay distinguishable. */
function parentLabel(kind: Kind, i: any) {
  if (kind === 'branches') return `${i.course?.name || ''} › ${i.name}`;
  if (kind === 'semesters') return `${i.branch?.course?.name || ''} › ${i.branch?.name || ''} › ${i.name}`;
  if (kind === 'subjects') return `${i.semester?.branch?.name || ''} › ${i.semester?.name || ''} › ${i.name}`;
  return i.name;
}

export default function AcademicManager({ kind }: { kind: Kind }) {
  const cfg = CFG[kind];
  useTitle(cfg.title);
  const toast = useToast();
  const list = useApi<{ items: any[] }>(`/academic/${kind}`);
  const parents = useApi<{ items: any[] }>(cfg.parent ? `/academic/${cfg.parent.kind}` : null);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const openNew = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (i: any) => {
    setEditing(i);
    const f: Record<string, any> = {};
    cfg.fields.forEach((x) => (f[x.key] = i[x.key] ?? ''));
    if (cfg.parent) f[cfg.parent.key] = i[cfg.parent.key]?._id || i[cfg.parent.key] || '';
    setForm(f); setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, any> = {};
      cfg.fields.forEach((x) => { const v = form[x.key]; if (v !== '' && v !== undefined) body[x.key] = x.type === 'number' ? Number(v) : String(v).trim(); });
      if (cfg.parent) body[cfg.parent.key] = form[cfg.parent.key];
      if (editing) await api.patch(`/academic/${kind}/${editing._id}`, body); else await api.post(`/academic/${kind}`, body);
      toast.ok(`${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} ${editing ? 'updated' : 'added'}`);
      setOpen(false); list.reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async (i: any) => {
    if (!window.confirm(`Delete this ${cfg.singular}?`)) return;
    try { await api.del(`/academic/${kind}/${i._id}`); toast.ok('Deleted'); list.reload(); } catch (e) { toast.err(errMsg(e)); }
  };

  const items = (list.data?.items || []).filter((i) => !filter || JSON.stringify(cfg.describe(i)).toLowerCase().includes(filter.toLowerCase()));
  const missingParents = cfg.parent && parents.data && parents.data.items.length === 0;
  const canSave = cfg.fields.filter((f) => f.required).every((f) => String(form[f.key] ?? '').trim() !== '') && (!cfg.parent || form[cfg.parent.key]);

  return (
    <>
      <PageHeader title={cfg.title} subtitle="Academic data is fully dynamic: add, rename or remove anything. Items that still contain children or materials cannot be deleted." actions={<button className="btn-primary" onClick={openNew} disabled={Boolean(missingParents)}><Plus className="h-4 w-4" /> Add {cfg.singular}</button>} />
      {missingParents && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Add at least one {cfg.parent!.label.toLowerCase()} first.</p>}
      <input className="input mb-4 max-w-sm" placeholder={`Filter ${cfg.title.toLowerCase()}...`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter list" />
      {list.loading && <PageLoader />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.data && (items.length === 0 ? <EmptyState title={`No ${cfg.title.toLowerCase()} found`} text={filter ? 'Try a different filter.' : `Add your first ${cfg.singular} to get started.`} /> : (
        <div className="card divide-y divide-slate-100">
          {items.map((i) => { const d = cfg.describe(i); return (
            <div key={i._id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.name}</p>{d.sub && <p className="truncate text-xs text-slate-500">{d.sub}</p>}</div>
              <button className="btn-outline btn-sm" onClick={() => openEdit(i)} aria-label={`Edit ${d.name}`}><Edit3 className="h-3.5 w-3.5" /></button>
              <button className="btn-outline btn-sm text-red-600" onClick={() => remove(i)} aria-label={`Delete ${d.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ); })}
        </div>
      ))}

      <Modal open={open} title={`${editing ? 'Edit' : 'Add'} ${cfg.singular}`} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {cfg.parent && (
            <Field label={cfg.parent.label}>
              <select className="input" value={form[cfg.parent.key] || ''} onChange={(e) => setForm({ ...form, [cfg.parent!.key]: e.target.value })}>
                <option value="">Select {cfg.parent.label.toLowerCase()}</option>
                {parents.data?.items.map((p) => <option key={p._id} value={p._id}>{parentLabel(cfg.parent!.kind, p)}</option>)}
              </select>
            </Field>
          )}
          {cfg.fields.map((f) => <Field key={f.key} label={f.label}><input className="input" type={f.type || 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /></Field>)}
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || !canSave} onClick={save}>Save</button></div>
        </div>
      </Modal>
    </>
  );
}
