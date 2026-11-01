import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Flag, MessageSquare, Plus, Search, ThumbsUp, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cx, formatDateTime, useApi, useDebounced, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, useToast } from '../../components/ui';

export function Forum() {
  useTitle('Discussion forum');
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [view, setView] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const qs = new URLSearchParams({ page: String(page) });
  if (dq) qs.set('q', dq); if (subject) qs.set('subject', subject);
  if (view === 'mine') qs.set('mine', '1'); if (view === 'open') qs.set('resolved', '0'); if (view === 'resolved') qs.set('resolved', '1');
  const list = useApi<{ items: any[]; page: number; pages: number }>(`/forum?${qs}`);
  const replies = useApi<{ items: any[] }>(view === 'replies' ? '/forum/mine/replies' : null);
  const [asking, setAsking] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', subject: '' });
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    try { const d = await api.post('/forum', form); toast.ok('Question posted'); setAsking(false); nav(`/forum/${d._id}`); } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Discussion forum" subtitle="Ask academic questions and help other students. Keep it respectful and on topic." actions={<button className="btn-primary" onClick={() => setAsking(true)}><Plus className="h-4 w-4" /> Ask a question</button>} />
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full py-2 text-sm outline-none" placeholder="Search discussions..." aria-label="Search discussions" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <select className="input !w-auto" aria-label="Subject" value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }}><option value="">All subjects</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
        <select className="input !w-auto" aria-label="View" value={view} onChange={(e) => { setView(e.target.value); setPage(1); }}><option value="">All discussions</option><option value="open">Unresolved</option><option value="resolved">Resolved</option><option value="mine">My questions</option><option value="replies">My replies</option></select>
      </div>

      {view === 'replies' ? (replies.loading ? <PageLoader /> : replies.data?.items.length ? <div className="card divide-y divide-slate-100">{replies.data.items.map((r) => <Link key={r._id} to={`/forum/${r.discussion._id}`} className="block p-4 hover:bg-slate-50"><p className="text-sm font-medium">{r.discussion.title}</p><p className="line-clamp-2 text-sm text-slate-500">{r.body}</p><p className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</p></Link>)}</div> : <EmptyState title="You have not replied yet" />) : (<>
        {list.loading && <PageLoader />}
        {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
        {list.data && (list.data.items.length === 0 ? <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="No discussions found" text="Be the first to ask a question." action={<button className="btn-primary" onClick={() => setAsking(true)}>Ask a question</button>} /> : (<>
          <div className="space-y-3">{list.data.items.map((d) => (
            <Link key={d._id} to={`/forum/${d._id}`} className="card flex items-start gap-4 p-5 transition hover:shadow-lift">
              <div className={cx('rounded-xl px-3 py-2 text-center', d.resolved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}><p className="text-lg font-bold leading-none">{d.replyCount}</p><p className="text-[10px] uppercase">replies</p></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{d.title}</h3>{d.resolved && <Badge tone="green">Resolved</Badge>}{d.hidden && <Badge tone="red">Hidden</Badge>}{d.subject && <Badge>{d.subject.name}</Badge>}</div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{d.body}</p><p className="mt-2 text-xs text-slate-400">{d.author?.name} · {formatDateTime(d.createdAt)}</p></div>
            </Link>))}</div>
          <Pagination page={list.data.page} pages={list.data.pages} onChange={setPage} /></>))}</>)}

      <Modal open={asking} title="Ask a question" onClose={() => setAsking(false)} wide>
        <div className="space-y-4">
          <Field label="Question title"><input className="input" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Subject (optional)"><select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option value="">General</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
          <Field label="Details" hint="Explain what you tried and where you are stuck (at least 10 characters)."><textarea className="input min-h-[140px]" maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setAsking(false)}>Cancel</button><button className="btn-primary" disabled={busy || form.title.trim().length < 5 || form.body.trim().length < 10} onClick={ask}>Post question</button></div>
        </div>
      </Modal>
    </>
  );
}

export function Thread() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<{ discussion: any; replies: any[]; canModerate: boolean }>(`/forum/${id}`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ kind: 'discussion' | 'reply'; id: string } | null>(null);
  const [reason, setReason] = useState('');
  useTitle(data?.discussion.title || 'Discussion');
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'Not found'} onRetry={reload} />;
  const { discussion: d, replies, canModerate } = data;
  const isAsker = d.author?._id === user?._id;
  const act = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); if (ok) toast.ok(ok); reload(); } catch (e) { toast.err(errMsg(e)); } };

  const postReply = async () => { setBusy(true); await act(async () => { await api.post(`/forum/${id}/replies`, { body }); setBody(''); }); setBusy(false); };
  const sendReport = async () => { if (!report) return; try { const r = await api.post(`/forum/${report.kind}/${report.id}/report`, { reason }); toast.ok(r.message); setReport(null); setReason(''); } catch (e) { toast.err(errMsg(e)); } };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/forum" className="text-sm font-semibold text-brand">&larr; All discussions</Link>
      <div className="card mt-3 p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">{d.resolved && <Badge tone="green">Resolved</Badge>}{d.hidden && <Badge tone="red">Hidden by moderator</Badge>}{d.subject && <Badge tone="blue">{d.subject.name}</Badge>}</div>
        <h1 className="text-xl font-bold">{d.title}</h1>
        <p className="mt-3 whitespace-pre-line text-slate-700">{d.body}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{d.author?.name} · {formatDateTime(d.createdAt)}</span>
          <span className="flex gap-2"><button className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => setReport({ kind: 'discussion', id: d._id })}><Flag className="h-3.5 w-3.5" /> Report</button>
            {(isAsker || canModerate) && <button className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => window.confirm('Delete this discussion and all replies?') && act(async () => { await api.del(`/forum/${d._id}`); nav('/forum'); })}><Trash2 className="h-3.5 w-3.5" /> Delete</button>}</span></div>
      </div>

      <h2 className="mb-3 mt-6 font-bold">{replies.length} {replies.length === 1 ? 'answer' : 'answers'}</h2>
      <div className="space-y-3">{replies.map((r) => (
        <div key={r._id} className={cx('card p-5', r.helpful && 'border-emerald-300 bg-emerald-50/40', r.hidden && 'opacity-60')}>
          {r.helpful && <p className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Marked as helpful</p>}
          {r.hidden && <Badge tone="red">Hidden</Badge>}
          <p className="whitespace-pre-line text-sm">{r.body}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{r.author?.name}{r.author?.role !== 'student' && <Badge tone="blue"> Staff</Badge>} · {formatDateTime(r.createdAt)}</span>
            <span className="flex flex-wrap gap-3">
              <button className={cx('inline-flex items-center gap-1', r.liked && 'font-bold text-brand')} onClick={() => act(() => api.post(`/forum/replies/${r._id}/like`))} aria-pressed={r.liked}><ThumbsUp className="h-3.5 w-3.5" /> {r.likeCount}</button>
              {(isAsker || canModerate) && <button className="hover:text-emerald-700" onClick={() => act(() => api.post(`/forum/replies/${r._id}/helpful`))}>{r.helpful ? 'Unmark helpful' : 'Mark helpful'}</button>}
              <button className="inline-flex items-center gap-1 hover:text-red-600" onClick={() => setReport({ kind: 'reply', id: r._id })}><Flag className="h-3.5 w-3.5" /> Report</button>
              {(r.author?._id === user?._id || canModerate) && <button className="hover:text-red-600" onClick={() => window.confirm('Delete this reply?') && act(() => api.del(`/forum/replies/${r._id}`))}>Delete</button>}</span></div>
        </div>))}</div>

      <div className="card mt-6 space-y-3 p-5"><h3 className="font-bold">Your answer</h3><textarea className="input min-h-[110px]" maxLength={3000} placeholder="Write a helpful, respectful answer..." value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn-primary" disabled={busy || body.trim().length < 2} onClick={postReply}>Post answer</button></div>

      <Modal open={Boolean(report)} title="Report inappropriate content" onClose={() => setReport(null)}>
        <div className="space-y-4"><Field label="What is wrong?"><textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Spam, abusive language, off-topic..." /></Field>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setReport(null)}>Cancel</button><button className="btn-danger" disabled={reason.trim().length < 3} onClick={sendReport}>Send report</button></div></div>
      </Modal>
    </div>
  );
}
