import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api, errMsg } from '../../lib/api';
import { Field, Spinner } from '../../components/ui';
import { BrandMark } from '../../components/Logo';
import { VexoraLogo } from '../../components/Logo';
import { useTitle } from '../../lib/utils';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const { settings } = useAuth();
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-brand-50 to-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card animate-fade-up p-7 sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 w-fit"><BrandMark size={44} /></div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <VexoraLogo size={18} /> Powered by {settings?.company.name || 'SHOURYA VEXORA'}
        </p>
      </div>
    </div>
  );
}

const pw = z.string().min(8, 'At least 8 characters').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers');

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={busy}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

function LoginForm({ admin }: { admin?: boolean }) {
  useTitle(admin ? 'Admin sign in' : 'Sign in');
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })),
  });
  const onSubmit = handleSubmit(async (v) => {
    setError('');
    try {
      const s = await login(v.email, v.password, admin);
      nav(admin ? '/admin' : loc.state?.from || (s.isStaff ? '/admin' : '/dashboard'), { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  });
  return (
    <AuthShell
      title={admin ? 'Admin sign in' : 'Welcome back'}
      subtitle={admin ? 'Administrators and content managers only' : 'Sign in to access your study materials'}
      footer={
        admin ? (
          <Link to="/login" className="font-medium text-brand">Student sign in</Link>
        ) : (
          <>New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link></>
        )
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input type="password" autoComplete="current-password" className="input" {...register('password')} />
        </Field>
        <div className="text-right"><Link to="/forgot-password" className="text-sm font-medium text-brand">Forgot password?</Link></div>
        <SubmitButton busy={isSubmitting}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}

export const Login = () => <LoginForm />;
export const AdminLogin = () => <LoginForm admin />;

export function Register() {
  useTitle('Create account');
  const { register: signup, settings } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string; email: string; enrollmentNo?: string; password: string; confirm: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().trim().min(2, 'Enter your full name'),
        email: z.string().email('Enter a valid email'),
        enrollmentNo: z.string().optional(),
        password: pw,
        confirm: z.string(),
      }).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
    ),
  });
  const onSubmit = handleSubmit(async ({ confirm: _c, ...v }) => {
    setError('');
    try {
      const r = await signup(v);
      if (r.needsVerification) setDone(r.message);
      else nav('/dashboard', { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  });
  if (settings && settings.allowRegistration === false)
    return <AuthShell title="Registration closed" subtitle="New accounts are not being accepted right now."><Link to="/login" className="btn-primary w-full">Sign in</Link></AuthShell>;
  if (done)
    return (
      <AuthShell title="Check your email" subtitle={done}>
        <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
      </AuthShell>
    );
  return (
    <AuthShell title="Create your account" subtitle="Free access to notes, papers and study resources" footer={<>Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Full name" error={errors.name?.message}><input className="input" autoComplete="name" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><input type="email" className="input" autoComplete="email" {...register('email')} /></Field>
        <Field label="Enrollment number (optional)" error={errors.enrollmentNo?.message}><input className="input" {...register('enrollmentNo')} /></Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters with letters and numbers">
          <input type="password" className="input" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}><input type="password" className="input" autoComplete="new-password" {...register('confirm')} /></Field>
        <SubmitButton busy={isSubmitting}>Create account</SubmitButton>
        <p className="text-center text-xs text-slate-400">By signing up you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  useTitle('Forgot password');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  const onSubmit = handleSubmit(async (v) => {
    setError('');
    try {
      const r = await api.post('/auth/forgot-password', v);
      setSent(r.message);
    } catch (e) {
      setError(errMsg(e));
    }
  });
  return (
    <AuthShell title="Forgot password?" subtitle="We will email you a link to reset it" footer={<Link to="/login" className="font-medium text-brand">Back to sign in</Link>}>
      {sent ? (
        <div className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" /> {sent}</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Field label="Email" error={errors.email?.message}><input type="email" className="input" {...register('email')} /></Field>
          <SubmitButton busy={isSubmitting}>Send reset link</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  useTitle('Reset password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(z.object({ password: pw, confirm: z.string() }).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })),
  });
  const onSubmit = handleSubmit(async (v) => {
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password: v.password });
      nav('/login', { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  });
  if (!token) return <AuthShell title="Invalid link" subtitle="This password reset link is incomplete."><Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link></AuthShell>;
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you have not used before">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="New password" error={errors.password?.message}><input type="password" className="input" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><input type="password" className="input" autoComplete="new-password" {...register('confirm')} /></Field>
        <SubmitButton busy={isSubmitting}>Update password</SubmitButton>
      </form>
    </AuthShell>
  );
}

export function VerifyEmail() {
  useTitle('Verify email');
  const [params] = useSearchParams();
  const [state, setState] = useState<{ loading: boolean; msg: string; ok: boolean }>({ loading: true, msg: '', ok: false });
  useEffect(() => {
    const token = params.get('token');
    if (!token) return setState({ loading: false, ok: false, msg: 'This verification link is incomplete.' });
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => setState({ loading: false, ok: true, msg: r.message }))
      .catch((e) => setState({ loading: false, ok: false, msg: errMsg(e) }));
  }, [params]);
  return (
    <AuthShell title="Email verification" subtitle={state.loading ? 'Verifying...' : state.msg}>
      {state.loading ? <div className="flex justify-center"><Spinner /></div> : <Link to="/login" className="btn-primary w-full">{state.ok ? 'Sign in' : 'Back to sign in'}</Link>}
    </AuthShell>
  );
}
