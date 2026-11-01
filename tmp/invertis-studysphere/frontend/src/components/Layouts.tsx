import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
  BarChart3, BookMarked, BookOpen, Building2, FolderTree, GraduationCap, HelpCircle, History, LayoutDashboard, LogOut,
  Mail, Megaphone, Menu, Settings, Shield, ShieldAlert, Tags, Upload, UserCog, Users, X, Flag, HardDrive, CalendarDays, Library, Calendar, Boxes, FileText, User as UserIcon, Bell, ClipboardList, ListChecks, MessagesSquare, NotebookPen, Trophy, FileClock,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { BrandMark, SiteName, VexoraLogo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { PageLoader } from './ui';
import { cx } from '../lib/utils';

// ---------------------------------------------------------------- guards

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  return <>{children}</>;
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, isStaff, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user || !isStaff) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

// ---------------------------------------------------------------- public layout

export function PublicLayout() {
  const { user, isStaff, settings, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/library', label: 'Study Library' },
    { to: '/browse', label: 'Browse' },
    { to: '/pyq', label: 'Question Papers' },
    { to: '/about', label: 'About' },
    { to: '/faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact' },
  ];
  const lc = ({ isActive }: { isActive: boolean }) => cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-navy');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Invertis StudySphere home">
            <BrandMark />
            <SiteName className="text-lg" />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={lc}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                <Link to={isStaff ? '/admin' : '/dashboard'} className="btn-soft">{isStaff ? 'Admin Panel' : 'My Dashboard'}</Link>
                <button className="btn-outline" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-outline">Sign in</Link>
                {settings?.allowRegistration !== false && <Link to="/register" className="btn-primary">Get started</Link>}
              </>
            )}
          </div>
          <button className="ml-auto rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="space-y-1 border-t bg-white px-4 py-3 lg:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={lc} onClick={() => setOpen(false)}>{l.label}</NavLink>
            ))}
            <div className="flex gap-2 pt-2">
              {user ? (
                <>
                  <Link to={isStaff ? '/admin' : '/dashboard'} className="btn-soft flex-1" onClick={() => setOpen(false)}>{isStaff ? 'Admin Panel' : 'Dashboard'}</Link>
                  <button className="btn-outline flex-1" onClick={async () => { await logout(); setOpen(false); nav('/'); }}>Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-outline flex-1" onClick={() => setOpen(false)}>Sign in</Link>
                  <Link to="/register" className="btn-primary flex-1" onClick={() => setOpen(false)}>Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

function Footer() {
  const { settings } = useAuth();
  const c = settings?.company;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5"><BrandMark /><SiteName className="text-lg" /></div>
          <p className="mt-3 max-w-sm text-sm text-slate-500">{settings?.tagline}</p>
          <p className="mt-4 text-xs text-slate-400">
            StudySphere is an independent platform for students. It is not an official website of Invertis University and does not claim any partnership or endorsement.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Platform</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link className="hover:text-brand" to="/library">Study Library</Link></li>
            <li><Link className="hover:text-brand" to="/browse">Browse by course</Link></li>
            <li><Link className="hover:text-brand" to="/faq">FAQ</Link></li>
            <li><Link className="hover:text-brand" to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link className="hover:text-brand" to="/about">About</Link></li>
            <li><Link className="hover:text-brand" to="/developer">About Developer</Link></li>
            <li><Link className="hover:text-brand" to="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-brand" to="/terms">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>&copy; {new Date().getFullYear()} {settings?.siteName}. Designed &amp; Developed by {c?.name || 'SHOURYA VEXORA'}.</span>
          <Link to="/developer" className="inline-flex items-center gap-2 font-medium hover:text-brand">
            <VexoraLogo size={20} /> {settings?.footerCredit}
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------- sidebar shell (student + admin)

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; perm?: string }

function SidebarShell({ items, title, badge }: { items: (NavItem | { heading: string })[]; title: string; badge?: string }) {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark size={32} />
        <div className="leading-tight">
          <SiteName className="block text-sm" />
          {badge && <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">{badge}</span>}
        </div>
        <div className="ml-auto"><NotificationBell /></div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label={title}>
        {items.map((it, i) => {
          if ('heading' in it) return <p key={i} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{it.heading}</p>;
          if (it.perm === 'super' ? user?.role !== 'super_admin' : it.perm && !can(it.perm)) return null;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700')}
            >
              {it.icon} {it.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 text-sm leading-tight">
            <p className="truncate font-semibold">{user?.name}</p>
            <p className="truncate text-xs capitalize text-slate-500">{user?.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button className="btn-outline w-full" onClick={async () => { await logout(); nav('/'); }}><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{content}</aside>
        </div>
      )}
      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2"><Menu /></button>
          <span className="font-bold">{title}</span>
          <div className="ml-auto"><NotificationBell /></div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

const ic = 'h-[18px] w-[18px]';

export function StudentLayout() {
  return (
    <SidebarShell
      title="Student Area"
      items={[
        { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, end: true },
        { to: '/library', label: 'Study Library', icon: <Library className={ic} /> },
        { to: '/browse', label: 'Browse Courses', icon: <FolderTree className={ic} /> },
        { to: '/pyq', label: 'Question Papers', icon: <FileClock className={ic} /> },
        { heading: 'Learn' },
        { to: '/quizzes', label: 'Quiz Center', icon: <Trophy className={ic} /> },
        { to: '/assignments', label: 'Assignments', icon: <ClipboardList className={ic} /> },
        { to: '/forum', label: 'Discussion Forum', icon: <MessagesSquare className={ic} /> },
        { heading: 'My Workspace' },
        { to: '/planner', label: 'Study Planner', icon: <ListChecks className={ic} /> },
        { to: '/workspace', label: 'Notes & Folders', icon: <NotebookPen className={ic} /> },
        { to: '/bookmarks', label: 'Bookmarks', icon: <BookMarked className={ic} /> },
        { to: '/downloads', label: 'Download History', icon: <History className={ic} /> },
        { to: '/notifications', label: 'Notifications', icon: <Bell className={ic} /> },
        { to: '/profile', label: 'My Profile', icon: <UserIcon className={ic} /> },
      ]}
    />
  );
}

export function AdminLayout() {
  return (
    <SidebarShell
      title="Admin Panel"
      badge="Admin Panel"
      items={[
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, end: true, perm: 'analytics.view' },
        { to: '/admin/analytics', label: 'Analytics', icon: <BarChart3 className={ic} />, perm: 'analytics.view' },
        { heading: 'Content' },
        { to: '/admin/materials', label: 'Manage Materials', icon: <FileText className={ic} />, perm: 'materials.upload' },
        { to: '/admin/upload', label: 'Upload Material', icon: <Upload className={ic} />, perm: 'materials.upload' },
        { to: '/admin/reports', label: 'Material Reports', icon: <Flag className={ic} />, perm: 'reports.manage' },
        { heading: 'Learning' },
        { to: '/admin/quizzes', label: 'Quizzes', icon: <Trophy className={ic} />, perm: 'quizzes.manage' },
        { to: '/admin/assignments', label: 'Assignments', icon: <ClipboardList className={ic} />, perm: 'assignments.manage' },
        { to: '/admin/forum', label: 'Forum Moderation', icon: <MessagesSquare className={ic} />, perm: 'forum.moderate' },
        { heading: 'Academic Structure' },
        { to: '/admin/courses', label: 'Courses', icon: <GraduationCap className={ic} />, perm: 'academic.manage' },
        { to: '/admin/branches', label: 'Branches', icon: <Building2 className={ic} />, perm: 'academic.manage' },
        { to: '/admin/semesters', label: 'Semesters', icon: <Calendar className={ic} />, perm: 'academic.manage' },
        { to: '/admin/subjects', label: 'Subjects', icon: <BookOpen className={ic} />, perm: 'academic.manage' },
        { to: '/admin/modules', label: 'Modules', icon: <Boxes className={ic} />, perm: 'academic.manage' },
        { to: '/admin/categories', label: 'Categories', icon: <Tags className={ic} />, perm: 'academic.manage' },
        { to: '/admin/academic-years', label: 'Academic Years', icon: <CalendarDays className={ic} />, perm: 'academic.manage' },
        { heading: 'People' },
        { to: '/admin/students', label: 'Students', icon: <Users className={ic} />, perm: 'users.manage' },
        { to: '/admin/administrators', label: 'Administrators', icon: <UserCog className={ic} />, perm: 'users.manage' },
        { heading: 'Communication' },
        { to: '/admin/announcements', label: 'Announcements', icon: <Megaphone className={ic} />, perm: 'communication.manage' },
        { to: '/admin/faqs', label: 'FAQs', icon: <HelpCircle className={ic} />, perm: 'communication.manage' },
        { to: '/admin/messages', label: 'Contact Messages', icon: <Mail className={ic} />, perm: 'communication.manage' },
        { heading: 'Platform' },
        { to: '/admin/storage', label: 'Storage', icon: <HardDrive className={ic} />, perm: 'analytics.view' },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: <Shield className={ic} />, perm: 'audit.view' },
        { to: '/admin/settings', label: 'Website Settings', icon: <Settings className={ic} />, perm: 'settings.manage' },
        { to: '/admin/permissions', label: 'Role Permissions', icon: <ShieldAlert className={ic} />, perm: 'super' },
      ]}
    />
  );
}
