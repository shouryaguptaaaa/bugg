import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApi, useDebounced, useTitle } from '../../lib/utils';
import type { Material, Paged } from '../../lib/types';
import { AcademicSelect, emptyAcademic, type AcademicValue } from '../../components/AcademicSelect';
import { MaterialCard } from '../../components/MaterialCard';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { cx } from '../../lib/utils';

const EXAMS = [['', 'All exam types'], ['mid_sem', 'Mid semester'], ['end_sem', 'End semester'], ['supplementary', 'Supplementary'], ['other', 'Other']];

/** Dedicated Previous Year Question Paper portal: year-wise, filterable, with an Important Questions tab. */
export default function PYQ() {
  useTitle('Previous year question papers');
  const [tab, setTab] = useState<'pyq' | 'important'>('pyq');
  const [ac, setAc] = useState<AcademicValue>(emptyAcademic);
  const [year, setYear] = useState('');
  const [exam, setExam] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const cats = useApi<{ items: { _id: string; name: string; slug?: string }[] }>('/academic/categories');
  const years = useApi<{ items: { _id: string; label: string }[] }>('/academic/academic-years');
  const catName = tab === 'pyq' ? 'previous year papers' : 'important questions';
  const cat = cats.data?.items.find((c) => c.name.toLowerCase() === catName);

  const qs = new URLSearchParams({ page: String(page), limit: '24', sort: 'newest' });
  if (cat) qs.set('category', cat._id);
  if (ac.course) qs.set('course', ac.course);
  if (ac.branch) qs.set('branch', ac.branch);
  if (ac.semester) qs.set('semester', ac.semester);
  if (ac.subject) qs.set('subject', ac.subject);
  if (year) qs.set('academicYear', year);
  if (exam && tab === 'pyq') qs.set('examType', exam);
  if (dq) qs.set('q', dq);
  const list = useApi<Paged<Material>>(cat ? `/materials?${qs}` : null);

  // group year-wise
  const groups = new Map<string, Material[]>();
  list.data?.items.forEach((m) => { const k = m.academicYear || 'Year not specified'; groups.set(k, [...(groups.get(k) || []), m]); });
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const reset = () => setPage(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Question paper portal" subtitle="Previous year papers organised year-wise, plus important questions shared by your seniors and faculty." />
      <div className="mb-5 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
        {([['pyq', 'Previous year papers'], ['important', 'Important questions']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); reset(); }} className={cx('rounded-lg px-4 py-2 text-sm font-semibold', tab === k ? 'bg-white shadow-sm' : 'text-slate-500')}>{l}</button>))}
      </div>
      <div className="card mb-6 space-y-4 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full py-2.5 text-sm outline-none" placeholder="Search by question paper name..." aria-label="Search question papers" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} /></div>
        <AcademicSelect value={ac} onChange={(v) => { setAc(v); reset(); }} withModule={false} />
        <div className="grid gap-4 sm:grid-cols-2">
          <select className="input" aria-label="Academic year" value={year} onChange={(e) => { setYear(e.target.value); reset(); }}><option value="">All years</option>{years.data?.items.map((y) => <option key={y._id} value={y.label}>{y.label}</option>)}</select>
          {tab === 'pyq' && <select className="input" aria-label="Exam type" value={exam} onChange={(e) => { setExam(e.target.value); reset(); }}>{EXAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
        </div>
      </div>

      {(cats.loading || list.loading) && <PageLoader />}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {cats.data && !cat && <EmptyState title="Category not found" text={`The "${catName}" category does not exist yet. An administrator can add it under Academic Structure → Categories.`} />}
      {list.data && (list.data.items.length === 0 ? <EmptyState title="Nothing found" text="Try clearing some filters." /> : (
        <>
          {sorted.map(([label, items]) => (
            <section key={label} className="mb-8"><h2 className="mb-3 text-lg font-bold">{label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((m) => <MaterialCard key={m._id} m={m} />)}</div></section>))}
          <Pagination page={list.data.page} pages={list.data.pages} onChange={setPage} />
        </>
      ))}
    </div>
  );
}
