import { Link } from 'react-router-dom';
import { BookMarked, Download, Eye, Library, Megaphone, Search, UserCircle2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { formatDate, useApi, useTitle } from '../../lib/utils';
import type { Material } from '../../lib/types';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { MaterialCard } from '../../components/MaterialCard';

interface Dash {
  stats: { bookmarks: number; downloads: number; views: number };
  recentlyViewed: { material: Material; at: string }[];
  recentDownloads: { material: Material; at: string }[];
  recentUploads: Material[];
  popular: Material[];
  announcements: { _id: string; title: string; body: string; priority: string; createdAt: string }[];
  topSubjects: { subject: { _id: string; name: string }; count: number }[];
  unreadNotifications: number;
  notifications: { _id: string; title: string; link?: string; read: boolean; createdAt: string }[];
  upcomingPlans: { _id: string; title: string; kind: string; date: string }[];
  pendingAssignments: { _id: string; title: string; dueDate: string }[];
  learning: { completed: number; inProgress: number; inProgressItems: { _id: string; title: string; percent: number }[]; quizAttempts: number; quizAverage: number };
  searches: { _id: string; q: string }[];
}

function Block({ title, link, children }: { title: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>{link && <Link to={link.to} className="text-sm font-semibold text-brand">{link.label}</Link>}</div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  useTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<Dash>('/me/dashboard');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader title={`${greet}, ${user?.name.split(' ')[0]}`} subtitle="Pick up where you left off." actions={<Link to="/library" className="btn-primary"><Search className="h-4 w-4" /> Search materials</Link>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Materials viewed" value={data.stats.views} icon={<Eye className="h-5 w-5" />} />
            <StatCard label="Downloads" value={data.stats.downloads} icon={<Download className="h-5 w-5" />} tone="green" />
            <StatCard label="Bookmarks" value={data.stats.bookmarks} icon={<BookMarked className="h-5 w-5" />} tone="amber" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card flex items-center gap-4 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xl font-bold text-brand-700">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user?.name[0]}</div>
              <div className="min-w-0"><p className="truncate font-semibold">{user?.name}</p><p className="truncate text-sm text-slate-500">{user?.email}</p>{user?.enrollmentNo && <p className="text-xs text-slate-400">Enrollment: {user.enrollmentNo}</p>}<Link to="/profile" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand"><UserCircle2 className="h-3.5 w-3.5" /> Edit profile</Link></div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Quick access</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{ to: '/library', l: 'Study Library', i: <Library className="h-5 w-5" /> }, { to: '/library?sort=downloads', l: 'Most downloaded', i: <Download className="h-5 w-5" /> }, { to: '/bookmarks', l: 'Bookmarks', i: <BookMarked className="h-5 w-5" /> }, { to: '/browse', l: 'Browse courses', i: <Search className="h-5 w-5" /> }].map((q) => (
                  <Link key={q.to} to={q.to} className="flex flex-col items-center gap-2 rounded-xl bg-brand-50 p-4 text-center text-xs font-semibold text-brand-700 transition hover:bg-brand-100">{q.i}{q.l}</Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Notifications {data.unreadNotifications > 0 && <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{data.unreadNotifications}</span>}</h2><Link to="/notifications" className="text-sm font-semibold text-brand">Open</Link></div>
              {data.notifications.length ? <ul className="space-y-2 text-sm">{data.notifications.map((n) => <li key={n._id}><Link to={n.link || '/notifications'} className={n.read ? 'text-slate-500' : 'font-semibold'}>{n.title}</Link></li>)}</ul> : <p className="text-sm text-slate-500">No notifications yet.</p>}
            </section>
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Coming up</h2><Link to="/planner" className="text-sm font-semibold text-brand">Planner</Link></div>
              {data.upcomingPlans.length + data.pendingAssignments.length === 0 ? <p className="text-sm text-slate-500">Nothing planned. Add study sessions in the planner.</p> : (
                <ul className="space-y-2 text-sm">{data.pendingAssignments.map((a) => <li key={a._id}><Link to={`/assignments/${a._id}`} className="font-medium text-brand">Assignment: {a.title}</Link> <span className="text-slate-500">due {formatDate(a.dueDate)}</span></li>)}
                  {data.upcomingPlans.map((p) => <li key={p._id}><span className="font-medium">{p.title}</span> <span className="text-slate-500">{formatDate(p.date)}</span></li>)}</ul>)}
            </section>
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Learning progress</h2><Link to="/workspace" className="text-sm font-semibold text-brand">Workspace</Link></div>
              <p className="text-sm text-slate-600">{data.learning.completed} materials completed · {data.learning.inProgress} in progress</p>
              <p className="text-sm text-slate-600">{data.learning.quizAttempts} quiz attempts{data.learning.quizAttempts ? ` · average ${data.learning.quizAverage}%` : ''}</p>
              {data.learning.inProgressItems.map((i) => <Link key={i._id} to={`/materials/${i._id}`} className="mt-3 block text-xs"><div className="flex justify-between"><span className="truncate font-medium">{i.title}</span><span>{i.percent}%</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${i.percent}%` }} /></div></Link>)}
            </section>
          </div>

          <Block title="Recently viewed">
            {data.recentlyViewed.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{data.recentlyViewed.map((r) => <MaterialCard key={r.material._id} m={r.material} />)}</div> : <EmptyState title="Nothing viewed yet" text="Materials you open will show up here." />}
          </Block>

          {data.topSubjects.length > 0 && (
            <Block title="Your subjects">
              <div className="flex flex-wrap gap-2">{data.topSubjects.map((s) => <Link key={s.subject._id} to={`/library?subject=${s.subject._id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">{s.subject.name} <span className="text-slate-400">· {s.count} opened</span></Link>)}</div>
            </Block>
          )}

          <Block title="Recently uploaded" link={{ to: '/library?sort=newest', label: 'See all' }}>
            {data.recentUploads.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{data.recentUploads.map((m) => <MaterialCard key={m._id} m={m} />)}</div> : <EmptyState title="No uploads yet" />}
          </Block>

          <Block title="Popular study materials" link={{ to: '/library?sort=downloads', label: 'See all' }}>
            {data.popular.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{data.popular.map((m) => <MaterialCard key={m._id} m={m} />)}</div> : <EmptyState title="No popular materials yet" />}
          </Block>

          {data.searches.length > 0 && (
            <Block title="Recent searches"><div className="flex flex-wrap gap-2">{data.searches.map((x) => <Link key={x._id} to={`/library?q=${encodeURIComponent(x.q)}`} className="rounded-xl bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200 hover:bg-brand-50">{x.q}</Link>)}</div></Block>
          )}

          <Block title="Academic announcements">
            {data.announcements.length ? (
              <div className="grid gap-4 md:grid-cols-2">{data.announcements.map((a) => <article key={a._id} className="card p-5"><p className="mb-1 flex items-center gap-2 text-xs text-slate-500"><Megaphone className="h-4 w-4 text-brand" /> {formatDate(a.createdAt)}</p><h3 className="font-semibold">{a.title}</h3><p className="mt-1 line-clamp-3 text-sm text-slate-600">{a.body}</p></article>)}</div>
            ) : <EmptyState title="No announcements" icon={<Megaphone className="h-6 w-6" />} />}
          </Block>
        </>
      )}
    </>
  );
}
