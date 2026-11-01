import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, useApi, useDebounced, useTitle } from '../../lib/utils';
import type { Paged, User } from '../../lib/types';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, statusTone, useToast } from '../../components/ui';

const ROLE_LABEL: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', content_manager: 'Content Manager', student: 'Student' };

export default function Users({ group }: { group: 'students' | 'staff' }) {
  const isStaff = group === 'staff';
  useTitle(isStaff ? 'Administrators' : 'Students');
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ group, page: String(page), limit: '15' });
  if (dq) qs.set('q', dq);
  if (status) qs.set('status', status);
  const { data, loading, error, reload } = useApi<Paged<User>>(`/admin/users?${qs}`);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: isStaff ? 'content_manager' : 'student', enrollmentNo: '' });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [edit, setEdit] = useState({ name: '', enrollmentNo: '', role: 'student' });

  const isSuper = me?.role === 'super_admin';
  const roleOptions = isStaff ? (isSuper ? ['content_manager', 'admin', 'super_admin'] : ['content_manager']) : ['student'];

  const patch = async (u: User, body: object, ok: string) => {
    try { await api.patch(`/admin/users/${u._id}`, body); toast.ok(ok); reload(); } catch (e) { toast.err(errMsg(e)); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/admin/users', { ...form, enrollmentNo: form.enrollmentNo || undefined });
      toast.ok('Account created'); setAdding(false); setForm({ ...form, name: '', email: '', password: '', enrollmentNo: '' }); reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  const canModify = (u: User) => u._id !== me?._id && (isSuper || !['admin', 'super_admin'].includes(u.role));

  return (
    <>
      <PageHeader title={isStaff ? 'Administrators & staff' : 'Students'} subtitle={isStaff ? 'Super Admins, Admins and Content Managers.' : 'Search, add, edit and suspend student accounts.'}
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add {isStaff ? 'staff member' : 'student'}</button>} />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search users" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, email or enrollment..." className="w-full bg-transparent py-2 text-sm outline-none" /></div>
        <select className="input !w-auto" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
      </div>

      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No users found" /> : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Name</th><th className="th">Role</th><th className="th">Status</th><th className="th">Joined</th><th className="th">Last login</th><th className="th text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <td className="td"><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}{u.enrollmentNo ? ` · ${u.enrollmentNo}` : ''}</p></td>
                    <td className="td"><Badge tone={u.role === 'student' ? 'slate' : 'blue'}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="td"><Badge tone={statusTone(u.status) as any}>{u.status}</Badge></td>
                    <td className="td text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="td text-slate-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="td"><div className="flex justify-end gap-1.5">
                      {canModify(u) ? (<>
                        <button className="btn-outline btn-sm" onClick={() => { setEditing(u); setEdit({ name: u.name, enrollmentNo: u.enrollmentNo || '', role: u.role }); }}>Edit</button>
                        {u.status === 'active'
                          ? <button className="btn-outline btn-sm text-red-600" onClick={() => window.confirm(`Suspend ${u.name}? They will be signed out and unable to log in.`) && patch(u, { status: 'suspended' }, 'Account suspended')}>Suspend</button>
                          : <button className="btn-soft btn-sm" onClick={() => patch(u, { status: 'active' }, 'Account reactivated')}>Reactivate</button>}
                      </>) : <span className="text-xs text-slate-400">{u._id === me?._id ? 'You' : 'Protected'}</span>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{data.total} account(s)</p>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}

      <Modal open={adding} title={`Add ${isStaff ? 'staff member' : 'student'}`} onClose={() => setAdding(false)}>
        <div className="space-y-4">
          <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Temporary password" hint="At least 8 characters with letters and numbers. Ask them to change it after signing in."><input type="text" autoComplete="off" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {isStaff ? <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            : <Field label="Enrollment number (optional)"><input className="input" value={form.enrollmentNo} onChange={(e) => setForm({ ...form, enrollmentNo: e.target.value })} /></Field>}
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" disabled={busy || form.name.trim().length < 2 || !form.email || form.password.length < 8} onClick={create}>Create account</button></div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title="Edit user" onClose={() => setEditing(null)}>
        <div className="space-y-4">
          <Field label="Full name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Enrollment number"><input className="input" value={edit.enrollmentNo} onChange={(e) => setEdit({ ...edit, enrollmentNo: e.target.value })} /></Field>
          {isSuper && <Field label="Role" hint="Super Admin only"><select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={async () => { const u = editing!; setEditing(null); await patch(u, { name: edit.name, enrollmentNo: edit.enrollmentNo, ...(isSuper && edit.role !== u.role ? { role: edit.role } : {}) }, 'User updated'); }}>Save</button></div>
        </div>
      </Modal>
    </>
  );
}
