import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Building2, Calendar, ChevronRight, GraduationCap } from 'lucide-react';
import { useApi, useTitle } from '../../lib/utils';
import { EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';

interface Item { _id: string; name?: string; code?: string; number?: number; branch?: any; course?: any; semester?: any }

function Crumbs({ parts }: { parts: { label: string; to?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500" aria-label="Breadcrumb">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {p.to ? <Link to={p.to} className="hover:text-brand">{p.label}</Link> : <span className="font-medium text-navy">{p.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export default function Browse() {
  useTitle('Browse courses');
  const [params] = useSearchParams();
  const course = params.get('course');
  const branch = params.get('branch');
  const semester = params.get('semester');
  const semesterNo = params.get('semesterNo');

  let path = '/academic/courses';
  let level: 'courses' | 'branches' | 'semesters' | 'subjects' | 'semesterNo' = 'courses';
  if (semester) { path = `/academic/subjects?parent=${semester}`; level = 'subjects'; }
  else if (branch) { path = `/academic/semesters?parent=${branch}`; level = 'semesters'; }
  else if (course) { path = `/academic/branches?parent=${course}`; level = 'branches'; }
  else if (semesterNo) { path = '/academic/semesters'; level = 'semesterNo'; }

  const { data, loading, error, reload } = useApi<{ items: Item[] }>(path);
  const items = data?.items || [];
  const filtered = level === 'semesterNo' ? items.filter((s) => String(s.number) === semesterNo) : items;

  // Resolve names for breadcrumbs from the loaded items
  const first: any = items[0];
  const courseName = first?.course?.name || first?.branch?.course?.name || first?.semester?.branch?.course?.name;
  const branchName = first?.branch?.name || first?.semester?.branch?.name;
  const semesterName = first?.semester?.name;

  const crumbs: { label: string; to?: string }[] = [{ label: 'All courses', to: '/browse' }];
  if (course && courseName) crumbs.push({ label: courseName, to: `/browse?course=${course}` });
  if (branch) {
    const cid = first?.branch?.course?._id || course;
    if (courseName && !course && cid) crumbs.push({ label: courseName, to: `/browse?course=${cid}` });
    if (branchName) crumbs.push({ label: branchName, to: `/browse?branch=${branch}` });
  }
  if (semester) {
    if (courseName) crumbs.push({ label: courseName, to: `/browse?course=${first?.semester?.branch?.course?._id}` });
    if (branchName) crumbs.push({ label: branchName, to: `/browse?branch=${first?.semester?.branch?._id}` });
    if (semesterName) crumbs.push({ label: semesterName });
  }
  if (level === 'semesterNo') crumbs.push({ label: `Semester ${semesterNo}` });

  const title = { courses: 'Browse by course', branches: 'Choose your branch', semesters: 'Choose a semester', subjects: 'Subjects', semesterNo: `Semester ${semesterNo}` }[level];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Crumbs parts={crumbs} />
      <PageHeader
        title={title}
        subtitle="Everything is organised as Course → Branch → Semester → Subject → Module"
        actions={semester ? <Link to={`/library?semester=${semester}`} className="btn-primary">All materials in this semester</Link> : undefined}
      />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && filtered.length === 0 && <EmptyState title="Nothing here yet" text="An administrator has not added anything at this level." />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((it) => {
          let to = '/library';
          let icon = <GraduationCap className="h-6 w-6" />;
          let label = it.name || '';
          let sub = '';
          if (level === 'courses') { to = `/browse?course=${it._id}`; sub = 'Branches & semesters'; }
          if (level === 'branches') { to = `/browse?branch=${it._id}`; icon = <Building2 className="h-6 w-6" />; sub = 'Semesters'; }
          if (level === 'semesters' || level === 'semesterNo') {
            to = `/browse?semester=${it._id}`; icon = <Calendar className="h-6 w-6" />; label = it.name || `Semester ${it.number}`;
            sub = level === 'semesterNo' ? `${it.branch?.course?.name || ''} · ${it.branch?.name || ''}` : 'Subjects';
          }
          if (level === 'subjects') { to = `/library?subject=${it._id}`; icon = <BookOpen className="h-6 w-6" />; sub = it.code || 'View materials'; }
          return (
            <Link key={it._id} to={to} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="rounded-xl bg-brand-50 p-3 text-brand">{icon}</div>
              <div className="min-w-0"><p className="truncate font-semibold">{label}</p><p className="truncate text-xs text-slate-500">{sub}</p></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
