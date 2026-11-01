import { Link } from 'react-router-dom';
import { BookOpen, CheckSquare, Download, Eye, FileText, Flag, HardDrive, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { VexoraLogo } from '../../components/Logo';
import { formatBytes, formatDateTime, useApi, useTitle } from '../../lib/utils';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { Navigate } from 'react-router-dom';

interface Stats {
  totals: { students: number; materials: number; downloads: number; views: number; pendingApprovals: number; subjects: number; openReports: number; storageBytes: number };
  popularSubjects: { _id: string; name: string; materials: number; downloads: number; views: number }[];
  recentUploads: { _id: string; title: string; createdAt: string; status: string; subject?: { name: string }; uploadedBy?: { name: string } }[];
  recentActivities: { _id: string; action: string; createdAt: string; user?: { name: string; role: string } }[];
}

export default function AdminDashboard() {
  useTitle('Admin dashboard');
  const { can, user, settings } = useAuth();
  const allowed = can('analytics.view');
  const { data, loading, error, reload } = useApi<Stats>(allowed ? '/admin/stats' : null);
  if (!allowed) return <Navigate to={can('materials.upload') ? '/admin/materials' : '/admin/login'} replace />;
  const c = settings?.company;

  return (
    <>
      <PageHeader title="Admin dashboard" subtitle={`Welcome back, ${user?.name.split(' ')[0]}. Everything below is live data from the database.`} actions={<Link to="/admin/upload" className="btn-primary">Upload material</Link>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Registered students" value={data.totals.students.toLocaleString('en-IN')} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Study materials" value={data.totals.materials.toLocaleString('en-IN')} icon={<FileText className="h-5 w-5" />} tone="green" />
            <StatCard label="Total downloads" value={data.totals.downloads.toLocaleString('en-IN')} icon={<Download className="h-5 w-5" />} />
            <StatCard label="Total views" value={data.totals.views.toLocaleString('en-IN')} icon={<Eye className="h-5 w-5" />} tone="green" />
            <StatCard label="Pending approvals" value={data.totals.pendingApprovals} icon={<CheckSquare className="h-5 w-5" />} tone="amber" />
            <StatCard label="Subjects" value={data.totals.subjects} icon={<BookOpen className="h-5 w-5" />} />
            <StatCard label="Open reports" value={data.totals.openReports} icon={<Flag className="h-5 w-5" />} tone="red" />
            <StatCard label="Storage used" value={formatBytes(data.totals.storageBytes)} icon={<HardDrive className="h-5 w-5" />} tone="amber" />
          </div>

          {data.totals.pendingApprovals > 0 && can('materials.approve') && (
            <Link to="/admin/materials?status=pending" className="mt-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              {data.totals.pendingApprovals} material(s) are waiting for approval <span className="font-semibold underline">Review now</span>
            </Link>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-bold">Popular subjects</h2>
              {data.popularSubjects.length ? (
                <ul className="divide-y divide-slate-100">{data.popularSubjects.map((s) => <li key={s._id} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{s.name}</span><span className="text-slate-500">{s.materials} files · {s.downloads} downloads</span></li>)}</ul>
              ) : <EmptyState title="No data yet" text="Popular subjects appear after materials are published and downloaded." />}
            </section>
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Recent uploads</h2><Link to="/admin/materials" className="text-sm font-semibold text-brand">Manage</Link></div>
              {data.recentUploads.length ? (
                <ul className="divide-y divide-slate-100">{data.recentUploads.map((m) => <li key={m._id} className="py-2.5 text-sm"><p className="truncate font-medium">{m.title}</p><p className="text-xs text-slate-500">{m.subject?.name} · {m.uploadedBy?.name} · {formatDateTime(m.createdAt)} · {m.status}</p></li>)}</ul>
              ) : <EmptyState title="No uploads yet" action={<Link to="/admin/upload" className="btn-primary">Upload the first material</Link>} />}
            </section>
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-3 font-bold">Recent activity</h2>
              {data.recentActivities.length ? (
                <ul className="divide-y divide-slate-100">{data.recentActivities.map((a) => <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><span className="font-medium">{a.user?.name || 'System'}</span> <span className="text-slate-500">· {a.action}</span></span><span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span></li>)}</ul>
              ) : <EmptyState title="No activity recorded yet" />}
            </section>
          </div>

          <section className="card mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <VexoraLogo size={52} />
            <div className="flex-1 text-sm">
              <p className="font-bold">{settings?.siteName} · developed by {c?.name}</p>
              <p className="text-slate-500">{c?.tagline} Founder: {c?.founder}.</p>
            </div>
            <Link to="/developer" className="btn-outline">Company page</Link>
          </section>
        </>
      )}
    </>
  );
}
