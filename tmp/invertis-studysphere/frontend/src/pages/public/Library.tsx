import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Filter, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounced, useTitle } from '../../lib/utils';
import type { Material, Paged } from '../../lib/types';
import { MaterialCard } from '../../components/MaterialCard';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { Link } from 'react-router-dom';

const RECENT_KEY = 'ss_recent_searches';
const getRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
};
const pushRecent = (q: string) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...getRecent().filter((x) => x !== q)].slice(0, 6))); } catch { /* storage unavailable */ }
};

const FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'jpg', 'png', 'mp4'];

function Select({ label, value, onChange, children, disabled }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>{children}</select>
    </div>
  );
}

export default function Library() {
  useTitle('Study Library');
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) || '';
  const [showFilters, setShowFilters] = useState(false);
  const [qInput, setQInput] = useState(get('q'));
  const [focus, setFocus] = useState(false);
  const [recent, setRecent] = useState<string[]>(getRecent());
  const debouncedQ = useDebounced(qInput, 250);
  const box = useRef<HTMLDivElement>(null);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Cascading academic filters (all data comes from the database)
  const courses = useApi<{ items: any[] }>('/academic/courses');
  const branches = useApi<{ items: any[] }>(get('course') ? `/academic/branches?parent=${get('course')}` : null);
  const semesters = useApi<{ items: any[] }>(get('branch') ? `/academic/semesters?parent=${get('branch')}` : null);
  const subjects = useApi<{ items: any[] }>(get('semester') ? `/academic/subjects?parent=${get('semester')}` : null);
  const allSubjects = useApi<{ items: any[] }>(!get('semester') ? '/academic/subjects' : null);
  const modules = useApi<{ items: any[] }>(get('subject') ? `/academic/modules?parent=${get('subject')}` : null);
  const categories = useApi<{ items: any[] }>('/academic/categories');
  const years = useApi<{ items: any[] }>('/academic/academic-years');

  const subjectList = get('semester') ? subjects.data?.items : allSubjects.data?.items;

  const query = useMemo(() => {
    const p = new URLSearchParams();
    ['q', 'course', 'branch', 'semester', 'subject', 'module', 'category', 'academicYear', 'fileType', 'sort', 'page', 'featured'].forEach((k) => params.get(k) && p.set(k, params.get(k)!));
    p.set('limit', '12');
    return p.toString();
  }, [params]);

  const { data, loading, error, reload } = useApi<Paged<Material>>(`/materials?${query}`);

  // Live suggestions
  const [suggestions, setSuggestions] = useState<{ _id: string; title: string }[]>([]);
  useEffect(() => {
    if (debouncedQ.trim().length < 2) return setSuggestions([]);
    let alive = true;
    api.get(`/materials/suggest?q=${encodeURIComponent(debouncedQ.trim())}`).then((r) => alive && setSuggestions(r.items)).catch(() => {});
    return () => { alive = false; };
  }, [debouncedQ]);

  useEffect(() => {
    const h = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setFocus(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = (e?: FormEvent, value?: string) => {
    e?.preventDefault();
    const v = (value ?? qInput).trim();
    setQInput(v);
    if (v) { pushRecent(v); setRecent(getRecent()); api.post('/me/searches', { q: v }).catch(() => {}); }
    set({ q: v });
    setFocus(false);
  };

  const activeFilters = ['course', 'branch', 'semester', 'subject', 'module', 'category', 'academicYear', 'fileType'].filter((k) => get(k)).length;
  const sort = get('sort') || (get('q') ? 'relevance' : 'newest');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Study Library</h1>
      <p className="mt-1 text-sm text-slate-500">Search and filter all published study materials.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div ref={box} className="relative flex-1">
          <form onSubmit={search} role="search" className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <Search className="ml-3 h-5 w-5 text-slate-400" />
            <input value={qInput} onFocus={() => setFocus(true)} onChange={(e) => setQInput(e.target.value)} placeholder="Search by title, subject, tag, year..." aria-label="Search materials" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" />
            {qInput && <button type="button" aria-label="Clear search" onClick={() => { setQInput(''); set({ q: '' }); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
            <button className="btn-primary">Search</button>
          </form>
          {focus && (suggestions.length > 0 || (!qInput && recent.length > 0)) && (
            <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
              {qInput
                ? suggestions.map((s) => <button key={s._id} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-50" onClick={() => search(undefined, s.title)}><Search className="h-4 w-4 text-slate-400" /> {s.title}</button>)
                : (
                  <>
                    <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent searches</p>
                    {recent.map((r) => <button key={r} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-50" onClick={() => search(undefined, r)}><Clock className="h-4 w-4 text-slate-400" /> {r}</button>)}
                  </>
                )}
            </div>
          )}
        </div>
        <select className="input sm:w-48" value={sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
          {get('q') && <option value="relevance">Most relevant</option>}
          <option value="newest">Newest first</option>
          <option value="downloads">Most downloaded</option>
          <option value="views">Most viewed</option>
        </select>
        <button className="btn-outline" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          <Filter className="h-4 w-4" /> Filters {activeFilters > 0 && <span className="badge bg-brand text-white">{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="card mt-4 grid animate-fade-up gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Course" value={get('course')} onChange={(v) => set({ course: v, branch: '', semester: '', subject: '', module: '' })}>
            <option value="">All courses</option>{courses.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Branch" value={get('branch')} disabled={!get('course')} onChange={(v) => set({ branch: v, semester: '', subject: '', module: '' })}>
            <option value="">All branches</option>{branches.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Semester" value={get('semester')} disabled={!get('branch')} onChange={(v) => set({ semester: v, subject: '', module: '' })}>
            <option value="">All semesters</option>{semesters.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Subject" value={get('subject')} onChange={(v) => set({ subject: v, module: '' })}>
            <option value="">All subjects</option>{subjectList?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Module" value={get('module')} disabled={!get('subject')} onChange={(v) => set({ module: v })}>
            <option value="">All modules</option>{modules.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Category" value={get('category')} onChange={(v) => set({ category: v })}>
            <option value="">All categories</option>{categories.data?.items.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Select label="Academic year" value={get('academicYear')} onChange={(v) => set({ academicYear: v })}>
            <option value="">Any year</option>{years.data?.items.map((c) => <option key={c._id} value={c.label}>{c.label}</option>)}
          </Select>
          <Select label="File type" value={get('fileType')} onChange={(v) => set({ fileType: v })}>
            <option value="">Any type</option>{FILE_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </Select>
          {activeFilters > 0 && <button className="btn-outline sm:col-span-2 lg:col-span-4" onClick={() => setParams(new URLSearchParams(get('q') ? { q: get('q') } : {}), { replace: true })}>Clear all filters</button>}
        </div>
      )}

      <div className="mt-6">
        {loading && <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && data && (
          <>
            <p className="mb-4 text-sm text-slate-500">{data.total} result{data.total === 1 ? '' : 's'}{get('q') ? ` for "${get('q')}"` : ''}</p>
            {data.items.length === 0 ? (
              <EmptyState
                title="No materials found"
                text="Try a shorter keyword, remove some filters, or browse by course instead."
                action={<div className="flex flex-wrap justify-center gap-2"><Link to="/browse" className="btn-primary">Browse courses</Link><button className="btn-outline" onClick={() => { setQInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Reset search</button></div>}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.items.map((m) => <MaterialCard key={m._id} m={m} />)}</div>
            )}
            <Pagination page={data.page} pages={data.pages} onChange={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </>
        )}
      </div>
    </div>
  );
}
