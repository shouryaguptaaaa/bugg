import { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { formatDateTime, useApi, useTitle } from '../../lib/utils';
import type { Paged } from '../../lib/types';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, statusTone, useToast } from '../../components/ui';

/** Shared list + create/edit modal used by Announcements and FAQs. */
function SimpleCrud<T extends { _id: string; published: boolean }>({
  title, subtitle, endpoint, fields, blank, render,
}: {
  title: string; subtitle: string; endpoint: string;
  fields: { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'bool'; options?: string[] }[];
  blank: Record<string, any>;
  render: (i: T) => { heading: string; text: string; badges?: React.ReactNode };
}) {
  useTitle(title);
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: T[] }>(endpoint);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, any>>(blank);
  const [busy, setBusy] = useState(false);

  const openNew = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (i: T) => { setEditing(i); setForm({ ...blank, ...(i as any) }); setOpen(true); };
  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, any> = {};
      fields.forEach((f) => (body[f.key] = f.type === 'number' ? Number(form[f.key] || 0) : form[f.key]));
      if (editing) await api.patch(`${endpoint}/${editing._id}`, body); else await api.post(endpoint, body);
      toast.ok('Saved'); setOpen(false); reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async (i: T) => {
    if (!window.confirm('Delete this item permanently?')) return;
    try { await api.del(`${endpoint}/${i._id}`); toast.ok('Deleted'); reload(); } catch (e) { toast.err(errMsg(e)); }
  };
  const togglePublish = async (i: T) => {
    try { await api.patch(`${endpoint}/${i._id}`, { published: !i.published }); reload(); } catch (e) { toast.err(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add new</button>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet`} action={<button className="btn-primary" onClick={openNew}>Create the first one</button>} /> : (
        <div className="space-y-3">
          {data.items.map((i) => { const r = render(i); return (
            <div key={i._id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{r.heading}</h3><Badge tone={i.published ? 'green' : 'slate'}>{i.published ? 'Published' : 'Hidden'}</Badge>{r.badges}</div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.text}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button className="btn-outline btn-sm" onClick={() => togglePublish(i)}>{i.published ? 'Hide' : 'Publish'}</button>
                <button className="btn-outline btn-sm" onClick={() => openEdit(i)} aria-label="Edit"><Edit3 className="h-3.5 w-3.5" /></button>
                <button className="btn-outline btn-sm text-red-600" onClick={() => remove(i)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ); })}
        </div>
      ))}
      <Modal open={open} title={editing ? 'Edit' : 'Add new'} onClose={() => setOpen(false)} wide>
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'textarea' ? <textarea className="input min-h-[110px]" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : f.type === 'select' ? <select className="input" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                : f.type === 'bool' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} /> Yes</label>
                : <input className="input" type={f.type} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </Field>
          ))}
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>Save</button></div>
        </div>
      </Modal>
    </>
  );
}

export function Announcements() {
  return (
    <SimpleCrud<any>
      title="Announcements" subtitle="Published announcements appear on the homepage and student dashboard, and every active student receives a notification."
      endpoint="/admin/announcements" blank={{ title: '', body: '', priority: 'normal', published: true }}
      fields={[{ key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Message', type: 'textarea' }, { key: 'priority', label: 'Priority', type: 'select', options: ['normal', 'important'] }, { key: 'published', label: 'Published', type: 'bool' }]}
      render={(a) => ({ heading: a.title, text: a.body, badges: a.priority === 'important' ? <Badge tone="amber">Important</Badge> : null })}
    />
  );
}

export function Faqs() {
  return (
    <SimpleCrud<any>
      title="FAQs" subtitle="Questions shown on the homepage and FAQ page, ordered by the number you set (lowest first)."
      endpoint="/admin/faqs" blank={{ question: '', answer: '', order: 0, published: true }}
      fields={[{ key: 'question', label: 'Question', type: 'text' }, { key: 'answer', label: 'Answer', type: 'textarea' }, { key: 'order', label: 'Order', type: 'number' }, { key: 'published', label: 'Published', type: 'bool' }]}
      render={(f) => ({ heading: f.question, text: f.answer })}
    />
  );
}

export function Messages() {
  useTitle('Contact messages');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi<Paged<any>>(`/admin/contact-messages?page=${page}${status ? `&status=${status}` : ''}`);
  const setS = async (id: string, s: string) => { try { await api.patch(`/admin/contact-messages/${id}`, { status: s }); reload(); } catch (e) { toast.err(errMsg(e)); } };
  const del = async (id: string) => { if (!window.confirm('Delete this message?')) return; try { await api.del(`/admin/contact-messages/${id}`); reload(); } catch (e) { toast.err(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Contact messages" subtitle="Messages sent from the public Contact page." actions={
        <select className="input !w-auto" aria-label="Filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All</option><option value="new">New</option><option value="read">Read</option><option value="resolved">Resolved</option></select>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No messages" /> : (
        <>
          <div className="space-y-3">{data.items.map((m) => (
            <div key={m._id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{m.subject || '(no subject)'}</h3><Badge tone={statusTone(m.status === 'new' ? 'pending' : m.status) as any}>{m.status}</Badge></div>
              <p className="text-xs text-slate-500">{m.name} · <a className="text-brand" href={`mailto:${m.email}`}>{m.email}</a> · {formatDateTime(m.createdAt)}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
              <div className="mt-3 flex gap-2">
                {m.status !== 'read' && <button className="btn-outline btn-sm" onClick={() => setS(m._id, 'read')}>Mark read</button>}
                {m.status !== 'resolved' && <button className="btn-soft btn-sm" onClick={() => setS(m._id, 'resolved')}>Resolve</button>}
                <button className="btn-outline btn-sm text-red-600" onClick={() => del(m._id)}>Delete</button>
              </div>
            </div>))}</div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}
    </>
  );
}
