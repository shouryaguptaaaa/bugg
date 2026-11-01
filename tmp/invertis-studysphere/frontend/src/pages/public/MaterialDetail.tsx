import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Calendar, Clock, Copy, Download, Eye, Flag, History, LogIn, Tag, User } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { FILE_COLORS, cx, formatBytes, formatDate, useApi, useTitle } from '../../lib/utils';
import type { Material } from '../../lib/types';
import { Badge, ErrorState, Field, Modal, PageLoader, statusTone, useToast } from '../../components/ui';
import { FileIcon, MaterialCard } from '../../components/MaterialCard';
import { MaterialExtras } from '../../components/MaterialExtras';

const REASONS = ['Wrong or misleading content', 'Copyright concern', 'Inappropriate content', 'Corrupted or unreadable file', 'Duplicate material', 'Other'];

export default function MaterialDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi<{ material: Material; bookmarked: boolean; canEdit: boolean; previewable: boolean }>(`/materials/${id}`);
  const related = useApi<{ items: Material[] }>(`/materials/${id}/related`);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  useTitle(data?.material.title || 'Material');

  // count one view per page open
  useEffect(() => {
    if (id) api.post(`/materials/${id}/view`).catch(() => {});
  }, [id]);

  if (loading) return <PageLoader />;
  if (error || !data) return <div className="mx-auto max-w-2xl px-4 py-16"><ErrorState message={error || 'Material not found'} onRetry={reload} /></div>;
  const { material: m, bookmarked, previewable } = data;
  const isPdf = m.file.ext === '.pdf';
  const needLogin = () => nav('/login', { state: { from: `/materials/${id}` } });

  const toggleBookmark = async () => {
    if (!user) return needLogin();
    try {
      const r = await api.post(`/materials/${id}/bookmark`);
      setData({ ...data, bookmarked: r.bookmarked });
      toast.ok(r.bookmarked ? 'Added to bookmarks' : 'Removed from bookmarks');
    } catch (e) { toast.err(errMsg(e)); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.ok('Link copied'); }
    catch { toast.err('Could not copy. Copy the address bar link instead.'); }
  };

  const submitReport = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/materials/${id}/report`, { reason, details });
      toast.ok(r.message); setReportOpen(false); setDetails('');
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link to="/library" className="hover:text-brand">Study Library</Link> / {m.subject && <Link to={`/library?subject=${m.subject._id}`} className="hover:text-brand">{m.subject.name}</Link>}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className={cx('rounded-2xl p-4', FILE_COLORS[m.file.ext] || 'bg-slate-100')}><FileIcon ext={m.file.ext} className="h-8 w-8" /></div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.category && <Badge tone="blue">{m.category.name}</Badge>}
                  {m.status !== 'published' && <Badge tone={statusTone(m.status) as any}>{m.status}</Badge>}
                  {m.publishAt && new Date(m.publishAt) > new Date() && <Badge tone="amber">Scheduled {formatDate(m.publishAt)}</Badge>}
                </div>
                <h1 className="text-2xl font-bold leading-snug">{m.title}</h1>
                {m.description && <p className="mt-3 whitespace-pre-line text-slate-600">{m.description}</p>}
              </div>
            </div>
            {m.rejectionReason && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Rejected: {m.rejectionReason}</p>}
            {m.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2"><Tag className="h-4 w-4 text-slate-400" />{m.tags.map((t) => <Link key={t} to={`/library?q=${encodeURIComponent(t)}`} className="badge bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700">#{t}</Link>)}</div>
            )}
          </div>

          {previewable && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <h2 className="font-semibold">Preview</h2>
                {user ? <button className="btn-soft btn-sm" onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Hide preview' : 'Show preview'}</button> : <button className="btn-soft btn-sm" onClick={needLogin}><LogIn className="h-4 w-4" /> Sign in to preview</button>}
              </div>
              {user && showPreview && (
                m.file.ext === '.mp4'
                  ? <video src={api.url(`/materials/${m._id}/preview`)} controls className="max-h-[70vh] w-full bg-black" />
                  : isPdf
                    ? <iframe title={`Preview of ${m.title}`} src={api.url(`/materials/${m._id}/preview`)} className="h-[70vh] w-full" />
                    : <img src={api.url(`/materials/${m._id}/preview`)} alt={m.title} className="mx-auto max-h-[70vh]" />
              )}
              {!showPreview && <p className="p-6 text-center text-sm text-slate-500">{user ? 'Open the preview to read this file without downloading it.' : 'Previewing and downloading need a free account.'}</p>}
            </div>
          )}

          {m.versions && m.versions.length > 0 && (
            <div className="card p-6">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-brand" /> Version history</h2>
              <ul className="space-y-2 text-sm text-slate-600">
                {[...m.versions].reverse().map((v, i) => <li key={i} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span className="truncate">{v.originalName}{v.note ? ` — ${v.note}` : ''}</span><span className="shrink-0 text-slate-400">replaced {formatDate(v.replacedAt)}</span></li>)}
              </ul>
              <p className="mt-2 text-xs text-slate-400">You are viewing the latest version.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-4 p-6">
            {user ? (
              <a href={api.url(`/materials/${m._id}/download`)} className="btn-primary w-full" onClick={() => setTimeout(() => reload(), 1500)}><Download className="h-4 w-4" /> Download ({formatBytes(m.file.size)})</a>
            ) : (
              <button className="btn-primary w-full" onClick={needLogin}><LogIn className="h-4 w-4" /> Sign in to download</button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={toggleBookmark}>{bookmarked ? <BookmarkCheck className="h-4 w-4 text-brand" /> : <Bookmark className="h-4 w-4" />} {bookmarked ? 'Saved' : 'Bookmark'}</button>
              <button className="btn-outline" onClick={copyLink}><Copy className="h-4 w-4" /> Copy link</button>
            </div>
            {user && <button className="btn-outline w-full text-slate-500" onClick={() => setReportOpen(true)}><Flag className="h-4 w-4" /> Report material</button>}
            {data.canEdit && <Link to="/admin/materials" className="btn-soft w-full">Manage in admin panel</Link>}
          </div>

          {user && <MaterialExtras id={m._id} />}

          <div className="card divide-y divide-slate-100 text-sm">
            {[
              ['Subject', m.subject?.name], ['Module', m.module?.name], ['Course', m.course?.name], ['Branch', m.branch?.name], ['Semester', m.semester?.name], ['Academic year', m.academicYear],
              ['File type', m.file.ext.replace('.', '').toUpperCase()], ['File size', formatBytes(m.file.size)],
            ].filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-5 py-3"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>)}
            <div className="flex justify-between gap-4 px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><User className="h-4 w-4" /> Uploaded by</span><span className="font-medium">{m.uploadedBy?.name}</span></div>
            <div className="flex justify-between gap-4 px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><Calendar className="h-4 w-4" /> Uploaded</span><span className="font-medium">{formatDate(m.createdAt)}</span></div>
            <div className="flex justify-between gap-4 px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><Clock className="h-4 w-4" /> Updated</span><span className="font-medium">{formatDate(m.updatedAt)}</span></div>
            <div className="flex justify-between gap-4 px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><Eye className="h-4 w-4" /> Views</span><span className="font-medium">{m.views}</span></div>
            <div className="flex justify-between gap-4 px-5 py-3"><span className="inline-flex items-center gap-1.5 text-slate-500"><Download className="h-4 w-4" /> Downloads</span><span className="font-medium">{m.downloads}</span></div>
          </div>
        </aside>
      </div>

      {related.data && related.data.items.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">More from {m.subject?.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.data.items.map((r) => <MaterialCard key={r._id} m={r} />)}</div>
        </section>
      )}

      <Modal open={reportOpen} title="Report this material" onClose={() => setReportOpen(false)}>
        <div className="space-y-4">
          <Field label="Reason"><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Details (optional)"><textarea className="input min-h-24" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setReportOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submitReport}>Submit report</button></div>
        </div>
      </Modal>
    </div>
  );
}
