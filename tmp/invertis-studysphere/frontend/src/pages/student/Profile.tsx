import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api, errMsg } from '../../lib/api';
import { formatDate, useTitle } from '../../lib/utils';
import { Field, PageHeader, useToast } from '../../components/ui';

export default function Profile() {
  useTitle('My profile');
  const { user, applySession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [enrollmentNo, setEnrollmentNo] = useState(user?.enrollmentNo || '');
  const [saving, setSaving] = useState(false);
  const [upl, setUpl] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const saveProfile = async () => {
    setSaving(true);
    try { applySession(await api.patch('/auth/profile', { name, enrollmentNo })); toast.ok('Profile updated'); } catch (e) { toast.err(errMsg(e)); } finally { setSaving(false); }
  };

  const onAvatar = async (f?: File) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.err('Image must be under 2 MB');
    setUpl(true);
    try {
      const fd = new FormData(); fd.append('avatar', f);
      applySession(await api.upload('/auth/avatar', fd));
      toast.ok('Profile picture updated');
    } catch (e) { toast.err(errMsg(e)); } finally { setUpl(false); if (file.current) file.current.value = ''; }
  };

  const changePw = async () => {
    if (pw.newPassword !== pw.confirm) return toast.err('New passwords do not match');
    setPwBusy(true);
    try { const r = await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); toast.ok(r.message); setPw({ currentPassword: '', newPassword: '', confirm: '' }); } catch (e) { toast.err(errMsg(e)); } finally { setPwBusy(false); }
  };

  return (
    <>
      <PageHeader title="My profile" subtitle="Manage your account details and password." />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <div className="card space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{user.avatarUrl ? <img src={user.avatarUrl} alt="Your profile" className="h-full w-full object-cover" /> : user.name[0]}</div>
              <button onClick={() => file.current?.click()} aria-label="Change profile picture" className="absolute -bottom-1 -right-1 rounded-full bg-brand p-2 text-white shadow hover:bg-brand-700">{upl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</button>
              <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
            </div>
            <div><p className="font-semibold">{user.email}</p><p className="text-xs capitalize text-slate-500">{user.role.replace('_', ' ')} · joined {formatDate(user.createdAt)}</p></div>
          </div>
          <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Enrollment number"><input className="input" value={enrollmentNo} onChange={(e) => setEnrollmentNo(e.target.value)} /></Field>
          <button className="btn-primary" onClick={saveProfile} disabled={saving || name.trim().length < 2}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>
        </div>

        <div className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Change password</h2>
          <Field label="Current password"><input type="password" autoComplete="current-password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters with letters and numbers"><input type="password" autoComplete="new-password" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password"><input type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          <button className="btn-primary" onClick={changePw} disabled={pwBusy || !pw.currentPassword || !pw.newPassword}>{pwBusy && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
          <p className="text-xs text-slate-400">Changing your password signs out all your other devices.</p>
        </div>
      </div>
    </>
  );
}
