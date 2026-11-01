import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, ChevronDown, Globe, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api, errMsg } from '../../lib/api';
import { cx, useApi, useTitle } from '../../lib/utils';
import { EmptyState, Field, PageLoader } from '../../components/ui';
import { VexoraLogo } from '../../components/Logo';

function Page({ title, subtitle, children, narrow = true }: { title: string; subtitle?: string; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={cx('mx-auto px-4 py-12 sm:px-6', narrow ? 'max-w-3xl' : 'max-w-5xl')}>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

const Prose = ({ children }: { children: ReactNode }) => <div className="space-y-4 text-[15px] leading-relaxed text-slate-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-navy [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>;

export function About() {
  useTitle('About');
  const { settings } = useAuth();
  return (
    <Page title={`About ${settings?.siteName || 'StudySphere'}`} subtitle={settings?.tagline}>
      <Prose>
        <p>{settings?.siteName} is a study material platform where notes, previous year papers, lab manuals and reference resources are organised by course, branch, semester, subject and module, so you can find exactly what you need quickly.</p>
        <h2>What you can do</h2>
        <ul>
          <li>Search and filter the study library by subject, semester, category, academic year and file type.</li>
          <li>Preview PDFs, download materials and bookmark the ones you use most.</li>
          <li>Follow academic announcements published by the administrators.</li>
        </ul>
        <h2>Independence notice</h2>
        <p>This is an independent student-focused platform. It is not an official website of Invertis University, and it does not claim any partnership, endorsement or authorisation from the University. Any use of university branding is subject to the University's permission.</p>
        <p>Built by <Link to="/developer" className="font-semibold text-brand">{settings?.company.name}</Link>.</p>
      </Prose>
    </Page>
  );
}

export function Faq() {
  useTitle('FAQ');
  const { data, loading } = useApi<{ items: { _id: string; question: string; answer: string }[] }>('/public/faqs');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Page title="Frequently asked questions">
      {loading && <PageLoader />}
      {data && data.items.length === 0 && <EmptyState title="No FAQs yet" text="Questions and answers will be listed here once administrators add them." />}
      <div className="space-y-3">
        {data?.items.map((f) => (
          <div key={f._id} className="card overflow-hidden">
            <button className="flex w-full items-center justify-between gap-4 p-4 text-left font-semibold" aria-expanded={open === f._id} onClick={() => setOpen(open === f._id ? null : f._id)}>
              {f.question}<ChevronDown className={cx('h-4 w-4 shrink-0 transition', open === f._id && 'rotate-180')} />
            </button>
            {open === f._id && <p className="border-t border-slate-100 p-4 text-sm text-slate-600">{f.answer}</p>}
          </div>
        ))}
      </div>
    </Page>
  );
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  subject: z.string().optional(),
  message: z.string().trim().min(10, 'Please write at least 10 characters'),
});

export function Contact() {
  useTitle('Contact');
  const { settings } = useAuth();
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError('');
    try { const r = await api.post('/public/contact', v); setSent(r.message); reset(); } catch (e) { setError(errMsg(e)); }
  });
  const info = [
    { i: <Mail className="h-4 w-4" />, v: settings?.contactEmail }, { i: <Phone className="h-4 w-4" />, v: settings?.contactPhone }, { i: <MapPin className="h-4 w-4" />, v: settings?.contactAddress },
  ].filter((x) => x.v);
  return (
    <Page title="Contact us" subtitle="Questions, feedback or want to contribute material? Send us a message." narrow={false}>
      <div className="grid gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          {sent ? (
            <div className="card flex gap-3 p-6 text-emerald-800"><CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" /><div><p className="font-semibold">{sent}</p><button className="mt-2 text-sm underline" onClick={() => setSent('')}>Send another message</button></div></div>
          ) : (
            <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
              {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
                <Field label="Email" error={errors.email?.message}><input type="email" className="input" {...register('email')} /></Field>
              </div>
              <Field label="Subject (optional)"><input className="input" {...register('subject')} /></Field>
              <Field label="Message" error={errors.message?.message}><textarea className="input min-h-32" {...register('message')} /></Field>
              <button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Send message</button>
            </form>
          )}
        </div>
        <div className="md:col-span-2">
          <div className="card space-y-4 p-6 text-sm">
            <h2 className="font-semibold">Contact information</h2>
            {info.length ? info.map((x, i) => <p key={i} className="flex items-start gap-3 text-slate-600"><span className="mt-0.5 text-brand">{x.i}</span>{x.v}</p>) : <p className="text-slate-500">Use the form to reach the administrators.</p>}
          </div>
        </div>
      </div>
    </Page>
  );
}

export function Privacy() {
  useTitle('Privacy Policy');
  const { settings } = useAuth();
  return (
    <Page title="Privacy Policy" subtitle="Template text — have it reviewed by the platform owner / legal advisor before launch.">
      <Prose>
        <h2>Information we collect</h2>
        <ul><li>Account details you provide: name, email address, optional enrollment number and profile picture.</li><li>Activity needed to run the platform: materials you view, download or bookmark, and administrative audit logs.</li></ul>
        <h2>How we use it</h2>
        <p>To provide sign-in, personalise your dashboard, show download history, keep the platform secure, and produce aggregate usage statistics for administrators.</p>
        <h2>Security</h2>
        <p>Passwords are stored only as salted hashes. Sessions use HttpOnly cookies. Files are served through protected routes that require sign-in.</p>
        <h2>Your choices</h2>
        <p>You can update your profile or change your password at any time. To request deletion of your account, contact {settings?.contactEmail || 'the administrators'} through the <Link className="text-brand underline" to="/contact">contact page</Link>.</p>
      </Prose>
    </Page>
  );
}

export function Terms() {
  useTitle('Terms & Conditions');
  return (
    <Page title="Terms & Conditions" subtitle="Template text — have it reviewed by the platform owner / legal advisor before launch.">
      <Prose>
        <h2>Using the platform</h2>
        <p>You agree to use study materials for personal learning, keep your account credentials private, and not attempt to access areas you are not authorised to use.</p>
        <h2>Content</h2>
        <p>Materials are shared for educational purposes. If you believe a material infringes your rights, use the Report button on the material page or contact us, and it will be reviewed promptly.</p>
        <h2>No official affiliation</h2>
        <p>This platform is not an official website of Invertis University and does not imply endorsement or authorisation by the University.</p>
        <h2>Accounts</h2>
        <p>Administrators may suspend accounts that misuse the platform. Services are provided "as is" without warranties.</p>
      </Prose>
    </Page>
  );
}

export function Developer() {
  useTitle('About Developer');
  const { settings } = useAuth();
  const c = settings?.company;
  if (!c) return <PageLoader />;
  return (
    <Page title="About Developer" narrow={false}>
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-800 to-brand p-8 text-white sm:p-10">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center"><div className="rounded-2xl bg-white/10 p-3"><VexoraLogo size={72} /></div>
            <div><h2 className="text-3xl font-extrabold tracking-tight text-white">{c.name}</h2><p className="mt-1 text-brand-100">{c.kind}</p><p className="mt-2 text-sm italic text-brand-100">{c.tagline}</p></div></div>
        </div>
        <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div><h3 className="text-lg font-bold">Company</h3><p className="mt-2 text-slate-600">{c.description}</p><p className="mt-3 text-sm font-medium text-brand-700">A product proudly developed by {c.name}.</p></div>
            <div><h3 className="text-lg font-bold">Product portfolio</h3>
              <ul className="mt-3 space-y-3">
                <li className="rounded-xl bg-brand-50 p-4"><p className="font-semibold">{settings?.siteName}</p><p className="text-sm text-slate-600">University learning and study material platform.</p></li>
                {c.portfolio.filter((p) => p.name).map((p, i) => <li key={i} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{p.name}</a> : p.name}</p>{p.description && <p className="text-sm text-slate-600">{p.description}</p>}</li>)}
              </ul>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Founder</p><p className="mt-1 text-lg font-bold">{c.founder}</p><p className="text-sm text-slate-500">{c.founderTitle}</p></div>
            <div className="space-y-3 text-sm text-slate-600">
              {c.website && <a className="flex items-center gap-2 hover:text-brand" href={c.website} target="_blank" rel="noopener noreferrer"><Globe className="h-4 w-4 text-brand" /> {c.website.replace(/^https?:\/\//, '')}</a>}
              {c.email && <a className="flex items-center gap-2 hover:text-brand" href={`mailto:${c.email}`}><Mail className="h-4 w-4 text-brand" /> {c.email}</a>}
              {c.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand" /> {c.phone}</p>}
              {!c.website && !c.email && !c.phone && <p className="text-slate-400">Contact details can be added in Admin &gt; Website Settings.</p>}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
