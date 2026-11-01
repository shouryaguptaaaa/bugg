import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cx, formatBytes, useApi, useTitle } from '../../lib/utils';
import { AcademicSelect, emptyAcademic, type AcademicValue } from '../../components/AcademicSelect';
import { Field, PageHeader, useToast } from '../../components/ui';
import { FileIcon } from '../../components/MaterialCard';

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.mp4';
const MAX_FILES = 20;

export default function UploadMaterial() {
  useTitle('Upload material');
  const { can } = useAuth();
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [ac, setAc] = useState<AcademicValue>(emptyAcademic);
  const [meta, setMeta] = useState({ title: '', description: '', category: '', academicYear: '', examType: '', tags: '', status: 'published', publishAt: '', allowDuplicate: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: { name: string; reason: string }[]; message: string } | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const categories = useApi<{ items: any[] }>('/academic/categories');
  const years = useApi<{ items: any[] }>('/academic/academic-years');
  const canApprove = can('materials.approve');

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    setFiles((prev) => {
      const key = (f: File) => `${f.name}:${f.size}`;
      const seen = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !seen.has(key(f)))].slice(0, MAX_FILES);
    });
    setResult(null);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); };

  const valid = files.length > 0 && ac.subject && meta.category && (files.length > 1 || meta.title.trim().length >= 2 || true);

  const submit = async () => {
    setError(''); setResult(null);
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('subject', ac.subject);
    if (ac.module) fd.append('module', ac.module);
    fd.append('category', meta.category);
    if (meta.title.trim()) fd.append('title', meta.title.trim());
    if (meta.description.trim()) fd.append('description', meta.description.trim());
    if (meta.academicYear) fd.append('academicYear', meta.academicYear);
    if (meta.examType) fd.append('examType', meta.examType);
    if (meta.tags.trim()) fd.append('tags', meta.tags);
    fd.append('status', meta.status);
    if (meta.publishAt) fd.append('publishAt', new Date(meta.publishAt).toISOString());
    if (meta.allowDuplicate) fd.append('allowDuplicate', '1');
    setProgress(0);
    try {
      const r = await api.upload('/materials', fd, setProgress);
      setResult({ created: r.items.length, skipped: r.skipped || [], message: r.message });
      toast.ok(r.message);
      setFiles([]);
      setMeta((m) => ({ ...m, title: '', description: '', tags: '', publishAt: '' }));
    } catch (e: any) {
      setError(errMsg(e));
      if (Array.isArray(e?.details)) setResult({ created: 0, skipped: e.details, message: '' });
    } finally { setProgress(null); }
  };

  const busy = progress !== null;

  return (
    <>
      <PageHeader title="Upload material" subtitle="Add one file or many at once. Files are validated by type, size and content, and duplicates are detected." actions={<Link to="/admin/materials" className="btn-outline">Manage materials</Link>} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">1. Files</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
              aria-label="Choose files to upload"
              className={cx('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition', drag ? 'border-brand bg-brand-50' : 'border-slate-300 hover:border-brand hover:bg-brand-50/50')}
            >
              <UploadCloud className="mb-2 h-10 w-10 text-brand" />
              <p className="font-semibold">Drag &amp; drop files here, or click to browse</p>
              <p className="mt-1 text-xs text-slate-500">PDF, DOC(X), PPT(X), XLS(X), ZIP, JPG, PNG, MP4 · up to {MAX_FILES} files per upload</p>
              <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            </div>
            {files.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileIcon ext={`.${f.name.split('.').pop()?.toLowerCase()}`} className="h-5 w-5 text-brand" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                    <button disabled={busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            {files.length > 1 && <p className="mt-2 text-xs text-slate-500">Bulk upload: every file shares the details below. Each title defaults to its file name.</p>}
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">2. Academic location</h2>
            <AcademicSelect value={ac} onChange={setAc} required />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">3. Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={files.length > 1 ? 'Title prefix (optional)' : 'Title'} hint={files.length <= 1 ? 'Leave empty to use the file name' : undefined}><input className="input" maxLength={200} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
              <Field label="Category *">
                <select className="input" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}><option value="">Select category</option>{categories.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
              </Field>
              <Field label="Academic year">
                <select className="input" value={meta.academicYear} onChange={(e) => setMeta({ ...meta, academicYear: e.target.value })}><option value="">Not specified</option>{years.data?.items.map((y) => <option key={y._id} value={y.label}>{y.label}</option>)}</select>
              </Field>
<Field label="Exam type (for question papers)"><select className="input" value={meta.examType} onChange={(e) => setMeta({ ...meta, examType: e.target.value })}><option value="">Not applicable</option><option value="mid_sem">Mid semester</option><option value="end_sem">End semester</option><option value="supplementary">Supplementary</option><option value="other">Other</option></select></Field>
              <Field label="Tags" hint="Comma separated, e.g. unit 1, sorting, important"><input className="input" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea className="input min-h-24" maxLength={2000} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-bold">4. Publishing</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select className="input" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
                  <option value="published">{canApprove ? 'Publish' : 'Submit for approval'}</option>
                  <option value="draft">Save as draft</option>
                </select>
              </Field>
              <Field label="Schedule publishing (optional)" hint="Hidden from students until this date and time"><input type="datetime-local" className="input" value={meta.publishAt} onChange={(e) => setMeta({ ...meta, publishAt: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={meta.allowDuplicate} onChange={(e) => setMeta({ ...meta, allowDuplicate: e.target.checked })} /> Allow files that already exist on the platform (skip duplicate detection)</label>
            {!canApprove && meta.status === 'published' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Your uploads are reviewed by an administrator before students can see them.</p>}
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="card space-y-4 p-5">
            <h2 className="font-bold">Summary</h2>
            <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Files</dt><dd className="font-medium">{files.length}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Total size</dt><dd className="font-medium">{formatBytes(files.reduce((s, f) => s + f.size, 0))}</dd></div></dl>
            {busy && (
              <div role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{progress === 100 ? 'Processing...' : 'Uploading...'}</span><span>{progress}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            {error && <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}
            <button className="btn-primary w-full" disabled={!valid || busy} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload {files.length > 1 ? `${files.length} files` : 'file'}</button>
            {!ac.subject || !meta.category ? <p className="text-xs text-slate-400">Choose a subject and category to continue.</p> : null}
          </div>

          {result && (
            <div className="card mt-4 space-y-3 p-5 text-sm">
              {result.created > 0 && <p className="flex gap-2 font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" /> {result.created} file(s) uploaded. {result.message}</p>}
              {result.skipped.length > 0 && (
                <div><p className="mb-1 font-medium text-amber-700">Skipped {result.skipped.length}:</p><ul className="space-y-1 text-xs text-slate-600">{result.skipped.map((s, i) => <li key={i}><span className="font-medium">{s.name}</span> — {s.reason}</li>)}</ul></div>
              )}
              {result.created > 0 && <Link to="/admin/materials" className="btn-soft w-full">View in Manage Materials</Link>}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
