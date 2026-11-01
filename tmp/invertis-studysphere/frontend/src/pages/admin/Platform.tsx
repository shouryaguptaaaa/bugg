import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Download, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatBytes, formatDateTime, useApi, useTitle } from '../../lib/utils';
import type { Paged, Settings } from '../../lib/types';
import { Badge, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, StatCard, statusTone, useToast } from '../../components/ui';

// ------------------------------------------------------------------ material reports

export function Reports() {
  useTitle('Reports');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useApi<Paged<any>>(`/admin/reports?page=${page}${status ? `&status=${status}` : ''}`);
  const set = async (id: string, s: string) => { try { await api.patch(`/admin/reports/${id}`, { status: s }); toast.ok('Updated'); reload(); } catch (e) { toast.err(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Reported materials" subtitle="Students can report wrong, copyrighted or broken materials. Review them here." actions={
        <select className="input !w-auto" aria-label="Filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="">All</option></select>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No reports" text="Nothing needs attention." /> : (
        <>
          <div className="space-y-3">{data.items.map((r) => (
            <div key={r._id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2">
                {r.material ? <Link className="font-semibold text-brand" to={`/materials/${r.material._id}`}>{r.material.title}</Link> : <span className="font-semibold">(material removed)</span>}
                <Badge tone={statusTone(r.status) as any}>{r.status}</Badge>
              </div>
              <p className="mt-1 text-sm"><strong>{r.reason}</strong>{r.details ? ` — ${r.details}` : ''}</p>
              <p className="text-xs text-slate-500">Reported by {r.user?.name} on {formatDateTime(r.createdAt)}</p>
              {r.status === 'open' && <div className="mt-3 flex gap-2"><button className="btn-soft btn-sm" onClick={() => set(r._id, 'resolved')}>Mark resolved</button><button className="btn-outline btn-sm" onClick={() => set(r._id, 'dismissed')}>Dismiss</button></div>}
            </div>))}</div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ audit logs

export function AuditLogs() {
  useTitle('Audit logs');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, loading, error, reload } = useApi<Paged<any>>(`/admin/audit-logs?page=${page}&limit=25${action ? `&action=${encodeURIComponent(action)}` : ''}`);
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Every important administrative action is recorded here." actions={
        <input className="input !w-52" placeholder="Filter, e.g. material." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter by action" />} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No log entries" /> : (
        <>
          <div className="card overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Details</th><th className="th">IP</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.items.map((l) => (
              <tr key={l._id}><td className="td whitespace-nowrap text-slate-500">{formatDateTime(l.createdAt)}</td><td className="td">{l.user?.name || 'System'}</td><td className="td font-mono text-xs">{l.action}</td>
                <td className="td max-w-xs truncate text-xs text-slate-500">{l.meta ? JSON.stringify(l.meta) : ''}</td><td className="td text-xs text-slate-400">{l.ip}</td></tr>))}</tbody>
          </table></div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ storage, health, backup

export function Storage() {
  useTitle('Storage & system');
  const { user } = useAuth();
  const stats = useApi<any>('/admin/stats');
  const health = useApi<any>('/admin/health');
  return (
    <>
      <PageHeader title="Storage & system health" subtitle="Live figures from the database and the running server." />
      {(stats.loading || health.loading) && <PageLoader />}
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {stats.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Storage used by materials" value={formatBytes(stats.data.totals.storageBytes)} icon={<Database className="h-5 w-5" />} />
            <StatCard label="Materials" value={stats.data.totals.materials} icon={<Database className="h-5 w-5" />} tone="green" />
            <StatCard label="Storage driver" value={stats.data.storageDriver} icon={<Database className="h-5 w-5" />} tone="amber" />
          </div>
          <section className="card mt-6 p-5">
            <h2 className="mb-3 font-bold">Usage by file type</h2>
            {stats.data.storageByType.length === 0 ? <p className="text-sm text-slate-500">No files uploaded yet.</p> : (
              <ul className="space-y-3">{stats.data.storageByType.map((t: any) => {
                const pct = stats.data.totals.storageBytes ? Math.round((t.bytes / stats.data.totals.storageBytes) * 100) : 0;
                return <li key={t.ext}><div className="flex justify-between text-sm"><span className="font-medium uppercase">{t.ext.replace('.', '')} <span className="text-slate-400">({t.count} files)</span></span><span>{formatBytes(t.bytes)}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div></li>;
              })}</ul>)}
          </section>
        </>
      )}
      {health.data && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 font-bold">System health</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[['Database', health.data.database], ['Environment', health.data.environment], ['Storage driver', health.data.storageDriver], ['Email service', health.data.emailConfigured ? 'Configured' : 'Not configured (emails print to server log)'],
              ['Uptime', `${Math.floor(health.data.uptimeSeconds / 3600)}h ${Math.floor((health.data.uptimeSeconds % 3600) / 60)}m`], ['Node.js', health.data.nodeVersion], ['Memory', `${health.data.memoryMb} MB`]].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-xl bg-slate-50 px-4 py-2.5"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
          </dl>
        </section>
      )}
      <section className="card mt-6 p-5">
        <h2 className="mb-1 font-bold">Backup &amp; recovery</h2>
        <p className="mb-4 text-sm text-slate-500">
          The database snapshot contains every collection (user passwords and tokens are never included). Uploaded files are stored in {stats.data?.storageDriver === 'cloudinary' ? 'Cloudinary' : 'the server upload folder'} and are backed up separately.
          For production also enable automatic backups in MongoDB Atlas. See docs/DEPLOYMENT.md.
        </p>
        {user?.role === 'super_admin'
          ? <a className="btn-primary" href={api.url('/admin/backup')}><Download className="h-4 w-4" /> Download database snapshot (JSON)</a>
          : <p className="text-sm text-slate-500">Only a Super Admin can download backups.</p>}
      </section>
    </>
  );
}

// ------------------------------------------------------------------ website + company settings

export function WebsiteSettings() {
  useTitle('Website settings');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<Settings>('/admin/settings');
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF(JSON.parse(JSON.stringify(data))); }, [data]);
  if (loading || !f) return error ? <ErrorState message={error} onRetry={reload} /> : <PageLoader />;

  const top = (k: keyof Settings, label: string, hint?: string) => <Field label={label} hint={hint}><input className="input" value={(f[k] as string) || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>;
  const co = (k: keyof Settings['company'], label: string, area = false) => <Field label={label}>{area
    ? <textarea className="input min-h-[90px]" value={(f.company[k] as string) || ''} onChange={(e) => setF({ ...f, company: { ...f.company, [k]: e.target.value } })} />
    : <input className="input" value={(f.company[k] as string) || ''} onChange={(e) => setF({ ...f, company: { ...f.company, [k]: e.target.value } })} />}</Field>;
  const setPortfolio = (i: number, k: string, v: string) => setF({ ...f, company: { ...f.company, portfolio: f.company.portfolio.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)) } });

  const save = async () => {
    setBusy(true);
    try {
      const { siteName, tagline, contactEmail, contactPhone, contactAddress, footerCredit, allowRegistration, company } = f;
      await api.put('/admin/settings', { siteName, tagline, contactEmail, contactPhone, contactAddress, footerCredit, allowRegistration,
        company: { name: company.name, tagline: company.tagline, kind: company.kind, description: company.description, founder: company.founder, founderTitle: company.founderTitle, website: company.website, email: company.email, phone: company.phone, logoUrl: company.logoUrl,
          portfolio: company.portfolio.filter((p) => p.name).map((p) => ({ name: p.name, description: p.description || '', url: p.url || '' })) } });
      toast.ok('Settings saved'); reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Website settings" subtitle="Branding, contact details and company information. Changes appear on the public site immediately." actions={<button className="btn-primary" disabled={busy} onClick={save}>Save changes</button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Site &amp; contact</h2>
          {top('siteName', 'Site name')}{top('tagline', 'Tagline')}{top('contactEmail', 'Contact email')}{top('contactPhone', 'Contact phone')}{top('contactAddress', 'Address')}{top('footerCredit', 'Footer credit line')}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allowRegistration} onChange={(e) => setF({ ...f, allowRegistration: e.target.checked })} /> Allow new student registrations</label>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Company (About Developer page)</h2>
          {co('name', 'Company name')}{co('tagline', 'Company tagline')}{co('kind', 'Company type')}{co('description', 'Description', true)}{co('founder', 'Founder name')}{co('founderTitle', 'Founder title')}{co('website', 'Website')}{co('email', 'Email')}{co('phone', 'Phone')}
          <Field label="Logo image URL" hint="Leave empty to use the built-in placeholder logo. Paste the link of the official logo when you have it."><input className="input" value={f.company.logoUrl || ''} onChange={(e) => setF({ ...f, company: { ...f.company, logoUrl: e.target.value } })} /></Field>
        </section>
        <section className="card space-y-3 p-5 lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="font-bold">Product portfolio</h2><button className="btn-outline btn-sm" onClick={() => setF({ ...f, company: { ...f.company, portfolio: [...f.company.portfolio, { name: '', description: '', url: '' }] } })}><Plus className="h-3.5 w-3.5" /> Add product</button></div>
          {f.company.portfolio.length === 0 && <p className="text-sm text-slate-500">No products listed.</p>}
          {f.company.portfolio.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
              <input className="input" placeholder="Product name" value={p.name || ''} onChange={(e) => setPortfolio(i, 'name', e.target.value)} />
              <input className="input" placeholder="Short description" value={p.description || ''} onChange={(e) => setPortfolio(i, 'description', e.target.value)} />
              <input className="input" placeholder="URL" value={p.url || ''} onChange={(e) => setPortfolio(i, 'url', e.target.value)} />
              <button className="btn-outline text-red-600" aria-label="Remove product" onClick={() => setF({ ...f, company: { ...f.company, portfolio: f.company.portfolio.filter((_, idx) => idx !== i) } })}><Trash2 className="h-4 w-4" /></button>
            </div>))}
        </section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ role permissions (Super Admin)

export function Permissions() {
  useTitle('Role permissions');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ catalogue: Record<string, string>; roles: Record<string, string[]>; defaults: Record<string, string[]> }>('/admin/permissions');
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  useEffect(() => { if (data) setRoles(JSON.parse(JSON.stringify(data.roles))); }, [data]);
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'Failed to load'} onRetry={reload} />;
  const toggle = (role: string, p: string) => setRoles({ ...roles, [role]: roles[role]?.includes(p) ? roles[role].filter((x) => x !== p) : [...(roles[role] || []), p] });
  const save = async (role: string) => { try { await api.put(`/admin/permissions/${role}`, { permissions: roles[role] || [] }); toast.ok('Permissions saved'); reload(); } catch (e) { toast.err(errMsg(e)); } };
  const editable = ['admin', 'content_manager'];
  return (
    <>
      <PageHeader title="Role permissions" subtitle="Super Admin always has every permission. Choose what Admins and Content Managers may do. Changes apply on their next request." />
      <div className="card overflow-x-auto"><table className="w-full min-w-[560px]">
        <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Permission</th>{editable.map((r) => <th key={r} className="th text-center capitalize">{r.replace('_', ' ')}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{Object.entries(data.catalogue).map(([p, label]) => (
          <tr key={p}><td className="td"><p className="font-medium">{label}</p><p className="font-mono text-xs text-slate-400">{p}</p></td>
            {editable.map((r) => <td key={r} className="td text-center"><input type="checkbox" className="h-4 w-4" checked={Boolean(roles[r]?.includes(p))} onChange={() => toggle(r, p)} aria-label={`${r} ${p}`} /></td>)}</tr>))}</tbody>
        <tfoot><tr><td className="td" />{editable.map((r) => <td key={r} className="td text-center"><button className="btn-primary btn-sm" onClick={() => save(r)}>Save {r.replace('_', ' ')}</button></td>)}</tr></tfoot>
      </table></div>
    </>
  );
}
