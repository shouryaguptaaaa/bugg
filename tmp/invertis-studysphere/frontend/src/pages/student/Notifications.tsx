import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, CheckCheck, ClipboardList, Megaphone, Trash2, Trophy, UserCog, BadgeCheck } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, formatDateTime, useApi, useTitle } from '../../lib/utils';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination, useToast } from '../../components/ui';

const ICON: Record<string, JSX.Element> = {
  material: <BookOpen className="h-4 w-4" />, announcement: <Megaphone className="h-4 w-4" />, quiz: <Trophy className="h-4 w-4" />,
  assignment: <ClipboardList className="h-4 w-4" />, approval: <BadgeCheck className="h-4 w-4" />, account: <UserCog className="h-4 w-4" />,
};
const PREFS: [string, string][] = [['material', 'New study materials'], ['announcement', 'Announcements'], ['quiz', 'Quizzes'], ['assignment', 'Assignments and deadlines'], ['approval', 'Approval updates'], ['account', 'Account and reminders'], ['email', 'Also send me emails (when the platform has email configured)']];
const changed = () => window.dispatchEvent(new Event('notifications-changed'));

export default function Notifications() {
  useTitle('Notifications');
  const nav = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload } = useApi<{ items: any[]; unread: number; page: number; pages: number }>(`/notifications?page=${page}${unreadOnly ? '&unread=1' : ''}`);
  const prefs = useApi<Record<string, boolean>>('/notifications/prefs');
  const [p, setP] = useState<Record<string, boolean>>({});
  useEffect(() => { if (prefs.data) setP(prefs.data); }, [prefs.data]);

  const open = async (n: any) => {
    if (!n.read) { await api.patch(`/notifications/${n._id}/read`).catch(() => {}); changed(); }
    if (n.link) nav(n.link); else reload();
  };
  const readAll = async () => { try { await api.post('/notifications/read-all'); changed(); reload(); } catch (e) { toast.err(errMsg(e)); } };
  const del = async (id: string) => { try { await api.del(`/notifications/${id}`); changed(); reload(); } catch (e) { toast.err(errMsg(e)); } };
  const setPref = async (k: string, v: boolean) => {
    const next = { ...p, [k]: v }; setP(next);
    try { await api.put('/notifications/prefs', { [k]: v }); } catch (e) { setP(p); toast.err(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="New materials, announcements, quizzes, deadlines and account updates." actions={<>
        <button className="btn-outline" onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}>{unreadOnly ? 'Show all' : 'Unread only'}</button>
        <button className="btn-soft" onClick={readAll} disabled={!data?.unread}><CheckCheck className="h-4 w-4" /> Mark all as read</button></>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {loading && <PageLoader />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {data && (data.items.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" text="New notifications will appear here instantly." /> : (
            <>
              <div className="card divide-y divide-slate-100">{data.items.map((n) => (
                <div key={n._id} className={cx('flex items-start gap-3 p-4', !n.read && 'bg-brand-50/50')}>
                  <div className={cx('mt-0.5 rounded-lg p-2', n.read ? 'bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-700')}>{ICON[n.type]}</div>
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                    <p className={cx('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </button>
                  <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" onClick={() => del(n._id)} aria-label="Delete notification"><Trash2 className="h-4 w-4" /></button>
                </div>))}</div>
              <Pagination page={data.page} pages={data.pages} onChange={setPage} />
            </>
          ))}
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-3 font-bold">Notification preferences</h2>
          <div className="space-y-3">{PREFS.map(([k, label]) => (
            <label key={k} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={p[k] ?? (k !== 'email')} onChange={(e) => setPref(k, e.target.checked)} /> <span>{label}</span></label>))}</div>
        </aside>
      </div>
    </>
  );
}
