import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Plus, Target, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, formatDate, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, StatCard, useToast } from '../../components/ui';

interface Plan { _id: string; title: string; kind: 'study' | 'goal' | 'exam' | 'assignment' | 'todo'; subject?: { _id: string; name: string }; date?: string; durationMin?: number; notes?: string; reminderAt?: string; done: boolean }
const KINDS: Record<string, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' }> = {
  study: { label: 'Study session', tone: 'blue' }, goal: { label: 'Daily goal', tone: 'green' }, exam: { label: 'Exam', tone: 'red' }, assignment: { label: 'Assignment deadline', tone: 'amber' }, todo: { label: 'To-do', tone: 'slate' },
};
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const toLocalInput = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const blank = (kind: Plan['kind'] = 'study', date = new Date()) => ({ title: '', kind, subject: '', date: dayKey(date), durationMin: '', notes: '', reminderAt: '' });

export default function Planner() {
  useTitle('Study planner');
  const toast = useToast();
  const [view, setView] = useState<'week' | 'month' | 'todo'>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const range = useMemo(() => {
    if (view === 'week') { const s = startOfWeek(anchor); return { from: s, to: new Date(s.getTime() + 7 * 86400000 - 1) }; }
    const s = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    return { from: s, to: new Date(s.getTime() + 42 * 86400000 - 1) };
  }, [view, anchor]);
  const plans = useApi<{ items: Plan[] }>(view === 'todo' ? '/me/plans?kind=todo' : `/me/plans?from=${range.from.toISOString()}&to=${range.to.toISOString()}`);
  const summary = useApi<any>('/me/plans/summary');
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [busy, setBusy] = useState(false);

  const refresh = () => { plans.reload(); summary.reload(); };
  const openNew = (kind: Plan['kind'] = 'study', date = new Date()) => { setEditing(null); setForm(blank(kind, date)); setOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ title: p.title, kind: p.kind, subject: p.subject?._id || '', date: p.date ? dayKey(new Date(p.date)) : '', durationMin: p.durationMin ?? '', notes: p.notes || '', reminderAt: toLocalInput(p.reminderAt) }); setOpen(true); };
  const save = async () => {
    setBusy(true);
    try {
      const body: any = { title: form.title, kind: form.kind, subject: form.subject, notes: form.notes, date: form.kind === 'todo' && !form.date ? null : new Date(`${form.date}T09:00:00`).toISOString(),
        durationMin: form.durationMin === '' ? undefined : Number(form.durationMin), reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null };
      if (editing) await api.patch(`/me/plans/${editing._id}`, body); else await api.post('/me/plans', body);
      toast.ok('Saved'); setOpen(false); refresh();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const toggle = async (p: Plan) => { try { await api.patch(`/me/plans/${p._id}`, { done: !p.done }); refresh(); } catch (e) { toast.err(errMsg(e)); } };
  const remove = async (p: Plan) => { if (!window.confirm('Delete this item?')) return; try { await api.del(`/me/plans/${p._id}`); refresh(); } catch (e) { toast.err(errMsg(e)); } };

  const byDay = useMemo(() => { const m = new Map<string, Plan[]>(); (plans.data?.items || []).forEach((p) => { if (p.date) { const k = dayKey(new Date(p.date)); m.set(k, [...(m.get(k) || []), p]); } }); return m; }, [plans.data]);
  const s = summary.data;

  const Item = ({ p }: { p: Plan }) => (
    <div className={cx('group flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-sm', p.done && 'opacity-60')}>
      <button onClick={() => toggle(p)} aria-label={p.done ? 'Mark as not done' : 'Mark as done'} className="mt-0.5 text-brand">{p.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button>
      <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(p)}>
        <p className={cx('font-medium', p.done && 'line-through')}>{p.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1"><Badge tone={KINDS[p.kind].tone}>{KINDS[p.kind].label}</Badge>{p.subject && <span className="text-xs text-slate-500">{p.subject.name}</span>}{p.durationMin ? <span className="flex items-center gap-0.5 text-xs text-slate-500"><Clock className="h-3 w-3" />{p.durationMin}m</span> : null}</div>
      </button>
      <button className="text-slate-300 hover:text-red-600" onClick={() => remove(p)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );

  const nav = (dir: number) => { const d = new Date(anchor); if (view === 'week') d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir); setAnchor(d); };
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => new Date(range.from.getTime() + i * 86400000));
  const todayKey = dayKey(new Date());

  return (
    <>
      <PageHeader title="Study planner" subtitle="Plan your week, set daily goals, track exams and deadlines." actions={<button className="btn-primary" onClick={() => openNew(view === 'todo' ? 'todo' : 'study')}><Plus className="h-4 w-4" /> Add {view === 'todo' ? 'to-do' : 'plan'}</button>} />
      {s && <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="This week: tasks completed" value={`${s.weekDone} / ${s.weekTotal}`} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Study minutes completed" value={s.weekMinutes} icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Open to-dos" value={s.todoOpen} icon={<Target className="h-5 w-5" />} tone="amber" />
        <StatCard label="Upcoming exams / deadlines" value={s.upcoming.length} icon={<CalendarDays className="h-5 w-5" />} tone="red" />
      </div>}
      {s?.upcoming.length > 0 && <div className="card mb-6 p-4"><h2 className="mb-2 text-sm font-bold">Coming up</h2><ul className="space-y-1 text-sm">{s.upcoming.map((u: Plan) => <li key={u._id} className="flex justify-between gap-3"><span><Badge tone={KINDS[u.kind].tone}>{KINDS[u.kind].label}</Badge> <span className="font-medium">{u.title}</span></span><span className="text-slate-500">{formatDate(u.date)}</span></li>)}</ul></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist">{([['week', 'Weekly'], ['month', 'Calendar'], ['todo', 'To-do list']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cx('rounded-lg px-4 py-2 text-sm font-semibold', view === k ? 'bg-white shadow-sm' : 'text-slate-500')}>{l}</button>))}</div>
        {view !== 'todo' && <div className="flex items-center gap-2"><button className="btn-outline btn-sm" onClick={() => nav(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[10rem] text-center text-sm font-semibold">{view === 'week' ? `${formatDate(range.from.toISOString())} – ${formatDate(new Date(range.to).toISOString())}` : anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          <button className="btn-outline btn-sm" onClick={() => nav(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
          <button className="btn-soft btn-sm" onClick={() => { setAnchor(new Date()); setSelected(todayKey); }}>Today</button></div>}
      </div>

      {plans.loading && !plans.data && <PageLoader />}
      {plans.error && <ErrorState message={plans.error} onRetry={plans.reload} />}

      {view === 'week' && plans.data && (
        <div className="grid gap-3 md:grid-cols-7">{days.map((d) => { const k = dayKey(d); const items = byDay.get(k) || []; return (
          <div key={k} className={cx('rounded-2xl border p-2.5', k === todayKey ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-slate-50/50')}>
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</p><button className="rounded p-1 text-brand hover:bg-brand-100" onClick={() => openNew('study', d)} aria-label={`Add plan on ${k}`}><Plus className="h-3.5 w-3.5" /></button></div>
            <div className="space-y-2">{items.map((p) => <Item key={p._id} p={p} />)}{items.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Free</p>}</div>
          </div>); })}</div>)}

      {view === 'month' && plans.data && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="card p-3"><div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">{days.map((d) => { const k = dayKey(d); const items = byDay.get(k) || []; const other = d.getMonth() !== anchor.getMonth(); return (
              <button key={k} onClick={() => setSelected(k)} className={cx('flex h-16 flex-col items-center rounded-xl border p-1 text-sm transition', k === selected ? 'border-brand bg-brand-50' : 'border-transparent hover:bg-slate-50', other && 'opacity-40', k === todayKey && 'font-bold text-brand')}>
                {d.getDate()}<span className="mt-auto flex gap-0.5">{items.slice(0, 4).map((p) => <span key={p._id} className={cx('h-1.5 w-1.5 rounded-full', p.done ? 'bg-slate-300' : p.kind === 'exam' ? 'bg-red-500' : p.kind === 'assignment' ? 'bg-amber-500' : 'bg-brand')} />)}</span></button>); })}</div></div>
          <div className="card h-fit p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{formatDate(selected)}</h2><button className="btn-soft btn-sm" onClick={() => openNew('study', new Date(`${selected}T09:00:00`))}><Plus className="h-3.5 w-3.5" /> Add</button></div>
            <div className="space-y-2">{(byDay.get(selected) || []).map((p) => <Item key={p._id} p={p} />)}{!(byDay.get(selected) || []).length && <p className="text-sm text-slate-500">Nothing planned for this day.</p>}</div></div>
        </div>)}

      {view === 'todo' && plans.data && (plans.data.items.length === 0 ? <EmptyState title="Your to-do list is empty" action={<button className="btn-primary" onClick={() => openNew('todo')}>Add a to-do</button>} /> : (
        <div className="grid gap-2 sm:grid-cols-2">{[...plans.data.items].sort((a, b) => Number(a.done) - Number(b.done)).map((p) => <Item key={p._id} p={p} />)}</div>))}

      <Modal open={open} title={editing ? 'Edit plan' : 'Add plan'} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type"><select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label={form.kind === 'todo' ? 'Date (optional)' : 'Date'}><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Subject (optional)"><select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option value="">No subject</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <Field label="Duration (minutes)"><input type="number" min={0} className="input" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
          </div>
          <Field label="Reminder (optional)" hint="You will get an in-app notification at this time."><input type="datetime-local" className="input" value={form.reminderAt} onChange={(e) => setForm({ ...form, reminderAt: e.target.value })} /></Field>
          <Field label="Notes (optional)"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || !form.title.trim() || (form.kind !== 'todo' && !form.date)} onClick={save}>Save</button></div>
        </div>
      </Modal>
    </>
  );
}
