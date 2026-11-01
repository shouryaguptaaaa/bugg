import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronDown, Download, FileText, GraduationCap, Megaphone, Search, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useApi, useTitle, formatDate, cx } from '../../lib/utils';
import { MaterialCard } from '../../components/MaterialCard';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import type { Material } from '../../lib/types';

interface HomeData {
  stats: { materials: number; students: number; subjects: number; downloads: number };
  courses: { _id: string; name: string; code?: string }[];
  semesterNumbers: number[];
  recent: Material[];
  mostDownloaded: Material[];
  featured: Material[];
  announcements: { _id: string; title: string; body: string; priority: string; createdAt: string }[];
  faqs: { _id: string; question: string; answer: string }[];
  popularSubjects: { _id: string; name: string; code?: string; materials: number; downloads: number }[];
}

function Section({ title, subtitle, link, children }: { title: string; subtitle?: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {link && <Link to={link.to} className="hidden items-center gap-1 text-sm font-semibold text-brand sm:inline-flex">{link.label} <ArrowRight className="h-4 w-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

function Grid({ items, empty }: { items: Material[]; empty: string }) {
  if (!items.length) return <EmptyState title={empty} text="Materials will appear here as soon as they are published." />;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{items.map((m) => <MaterialCard key={m._id} m={m} />)}</div>;
}

export default function Home() {
  useTitle('');
  const { settings } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<HomeData>('/public/home');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/library${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-surface">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-card">
            <GraduationCap className="h-4 w-4" /> {settings?.siteName || 'Invertis StudySphere'}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-6xl">
            All your study materials,<br className="hidden sm:block" /> <span className="text-brand">one organised place.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{settings?.tagline}</p>
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-slate-200" role="search">
            <Search className="ml-3 h-5 w-5 shrink-0 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, subjects, papers, tags..." aria-label="Search study materials" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" />
            <button className="btn-primary">Search</button>
          </form>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/library" className="btn-primary">Explore Study Materials <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/browse" className="btn-outline">Browse by course</Link>
          </div>
        </div>
      </section>

      {loading && <PageLoader />}
      {error && <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>}

      {data && (
        <>
          {/* STATS — all numbers come from the database */}
          <section className="mx-auto -mt-2 max-w-7xl px-4 sm:px-6" aria-label="Platform statistics">
            <div className="card grid grid-cols-2 divide-slate-100 md:grid-cols-4 md:divide-x">
              {[
                { l: 'Study materials', v: data.stats.materials, i: <FileText className="h-5 w-5" /> },
                { l: 'Registered students', v: data.stats.students, i: <Users className="h-5 w-5" /> },
                { l: 'Subjects', v: data.stats.subjects, i: <BookOpen className="h-5 w-5" /> },
                { l: 'Total downloads', v: data.stats.downloads, i: <Download className="h-5 w-5" /> },
              ].map((s) => (
                <div key={s.l} className="flex items-center gap-3 p-5">
                  <div className="rounded-xl bg-brand-50 p-2.5 text-brand">{s.i}</div>
                  <div><p className="text-2xl font-bold">{fmt(s.v)}</p><p className="text-xs text-slate-500">{s.l}</p></div>
                </div>
              ))}
            </div>
          </section>

          <Section title="Browse by course" subtitle="Pick your course to see branches, semesters and subjects">
            {data.courses.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.courses.map((c) => (
                  <Link key={c._id} to={`/browse?course=${c._id}`} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="rounded-xl bg-brand-50 p-3 text-brand"><GraduationCap className="h-6 w-6" /></div>
                    <div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">View branches &amp; semesters</p></div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No courses yet" text="Courses are added by administrators." />}
          </Section>

          {data.semesterNumbers.length > 0 && (
            <Section title="Browse by semester">
              <div className="flex flex-wrap gap-3">
                {data.semesterNumbers.map((n) => (
                  <Link key={n} to={`/browse?semesterNo=${n}`} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold shadow-card transition hover:border-brand hover:text-brand">Semester {n}</Link>
                ))}
              </div>
            </Section>
          )}

          <Section title="Popular subjects" subtitle="Ranked by downloads">
            {data.popularSubjects.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.popularSubjects.map((s) => (
                  <Link key={s._id} to={`/library?subject=${s._id}`} className="card p-4 transition hover:border-brand">
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{s.materials} materials · {s.downloads} downloads</p>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No subjects with materials yet" />}
          </Section>

          {data.featured.length > 0 && <Section title="Featured study resources" link={{ to: '/library?featured=1', label: 'View all' }}><Grid items={data.featured} empty="" /></Section>}
          <Section title="Recently uploaded" link={{ to: '/library?sort=newest', label: 'View all' }}><Grid items={data.recent} empty="Nothing uploaded yet" /></Section>
          <Section title="Most downloaded resources" link={{ to: '/library?sort=downloads', label: 'View all' }}><Grid items={data.mostDownloaded} empty="No downloads recorded yet" /></Section>

          <Section title="Academic announcements">
            {data.announcements.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.announcements.map((a) => (
                  <article key={a._id} className={cx('card p-5', a.priority === 'important' && 'border-amber-300 bg-amber-50/40')}>
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><Megaphone className="h-4 w-4 text-brand" /> {formatDate(a.createdAt)}{a.priority === 'important' && <span className="badge bg-amber-100 text-amber-700">Important</span>}</div>
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{a.body}</p>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No announcements" text="Academic announcements will be posted here." icon={<Megaphone className="h-6 w-6" />} />}
          </Section>

          <Section title="Frequently asked questions" link={{ to: '/faq', label: 'All FAQs' }}>
            {data.faqs.length ? (
              <div className="mx-auto max-w-3xl space-y-3">
                {data.faqs.slice(0, 6).map((f) => (
                  <div key={f._id} className="card overflow-hidden">
                    <button className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-semibold" aria-expanded={openFaq === f._id} onClick={() => setOpenFaq(openFaq === f._id ? null : f._id)}>
                      {f.question} <ChevronDown className={cx('h-4 w-4 shrink-0 transition', openFaq === f._id && 'rotate-180')} />
                    </button>
                    {openFaq === f._id && <p className="border-t border-slate-100 p-4 text-sm text-slate-600">{f.answer}</p>}
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No FAQs yet" />}
          </Section>

          <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="card p-7">
                <h2 className="text-xl font-bold">About us</h2>
                <p className="mt-2 text-sm text-slate-600">{settings?.siteName} brings notes, previous year papers and reference material together so students spend less time searching and more time learning.</p>
                <Link to="/about" className="btn-soft mt-4">Learn more</Link>
              </div>
              <div className="card p-7">
                <h2 className="text-xl font-bold">Contact us</h2>
                <p className="mt-2 text-sm text-slate-600">Found a problem or want to contribute material? Send us a message and we will respond.</p>
                <Link to="/contact" className="btn-primary mt-4">Get in touch</Link>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
