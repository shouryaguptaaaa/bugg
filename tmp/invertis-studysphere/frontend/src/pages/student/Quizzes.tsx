import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Clock, Flag, HelpCircle, Play, Trophy, XCircle } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, formatDateTime, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, PageHeader, PageLoader, Pagination, StatCard, useToast } from '../../components/ui';

const CAT: Record<string, string> = { mock_test: 'Mock test', practice: 'Practice', topic_test: 'Topic test', weekly: 'Weekly quiz', other: 'Quiz' };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ Quiz Center

export function QuizCenter() {
  useTitle('Quiz center');
  const [tab, setTab] = useState<'quizzes' | 'practice' | 'leaderboard' | 'performance' | 'history'>('quizzes');
  const tabs = [['quizzes', 'Quizzes & mock tests'], ['practice', 'Topic practice'], ['leaderboard', 'Leaderboard'], ['performance', 'My performance'], ['history', 'Attempt history']] as const;
  return (
    <>
      <PageHeader title="Quiz center" subtitle="Timed mock tests, topic practice and your performance analytics." />
      <div className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1" role="tablist">{tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold', tab === k ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50')}>{l}</button>))}</div>
      {tab === 'quizzes' && <QuizList />}
      {tab === 'practice' && <Practice />}
      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'performance' && <Performance />}
      {tab === 'history' && <History />}
    </>
  );
}

function QuizList() {
  const nav = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const qs = new URLSearchParams(); if (subject) qs.set('subject', subject); if (category) qs.set('category', category);
  const { data, loading, error, reload } = useApi<{ items: any[] }>(`/quizzes?${qs}`);
  const [starting, setStarting] = useState('');
  const start = async (id: string) => {
    setStarting(id);
    try { const r = await api.post(`/quizzes/${id}/start`); nav(`/quizzes/take/${r.attempt._id}`); } catch (e) { toast.err(errMsg(e)); setStarting(''); }
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input !w-auto" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All subjects</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
        <select className="input !w-auto" aria-label="Type" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All types</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState icon={<HelpCircle className="h-6 w-6" />} title="No quizzes available" text="Quizzes published by your instructors will appear here." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((q) => (
          <div key={q._id} className="card flex flex-col p-5">
            <div className="mb-2 flex flex-wrap gap-1.5"><Badge tone="blue">{CAT[q.category]}</Badge>{q.subject && <Badge>{q.subject.name}</Badge>}</div>
            <h3 className="font-bold">{q.title}</h3>
            {q.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{q.description}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"><span>{q.questionCount} questions</span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{q.durationMinutes} min</span><span>Pass: {q.passPercent}%</span></p>
            <div className="mt-auto flex items-center justify-between pt-4"><span className="text-xs text-slate-500">{q.attempts ? `Best: ${q.bestPercent}% · ${q.attempts} attempt(s)` : 'Not attempted'}</span>
              <button className="btn-primary btn-sm" disabled={starting === q._id} onClick={() => start(q._id)}><Play className="h-3.5 w-3.5" /> {q.attempts ? 'Try again' : 'Start'}</button></div>
          </div>))}</div>))}
    </>
  );
}

function Practice() {
  const nav = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const topics = useApi<{ items: { topic: string; count: number }[] }>(`/quizzes/practice/topics${subject ? `?subject=${subject}` : ''}`);
  const start = async () => {
    setBusy(true);
    try { const r = await api.post('/quizzes/practice/start', { subject: subject || undefined, topic: topic || undefined, count }); nav(`/quizzes/take/${r.attempt._id}`); } catch (e) { toast.err(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="card max-w-xl space-y-4 p-6">
      <p className="text-sm text-slate-500">Untimed practice built from questions in published quizzes. Pick a subject, a topic or both. You see the correct answers and explanations at the end.</p>
      <Field label="Subject"><select className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(''); }}><option value="">Any subject</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
      <Field label="Topic" hint={topics.data?.items.length ? undefined : 'No topics tagged yet for this subject.'}><select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Any topic</option>{topics.data?.items.map((t) => <option key={t.topic} value={t.topic}>{t.topic} ({t.count})</option>)}</select></Field>
      <Field label="Number of questions"><select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
      <button className="btn-primary" disabled={busy || (!subject && !topic)} onClick={start}><Play className="h-4 w-4" /> Start practice</button>
    </div>
  );
}

function Leaderboard() {
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/quizzes/leaderboard');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.items.length) return <EmptyState icon={<Trophy className="h-6 w-6" />} title="No scores yet" text="Complete a quiz to appear on the leaderboard." />;
  return (
    <div className="card overflow-x-auto"><table className="w-full min-w-[420px]"><thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Rank</th><th className="th">Student</th><th className="th">Average of best scores</th><th className="th">Quizzes</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{data.items.map((r) => (
        <tr key={r.userId} className={cx(r.isMe && 'bg-brand-50/60')}><td className="td font-bold">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `#${r.rank}`}</td><td className="td font-medium">{r.name}{r.isMe && <Badge tone="blue"> You</Badge>}</td><td className="td">{r.avgPercent}%</td><td className="td">{r.quizzes}</td></tr>))}</tbody></table></div>
  );
}

function Performance() {
  const { data, loading, error, reload } = useApi<any>('/quizzes/me/analytics');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.totalAttempts === 0) return <EmptyState title="No data yet" text="Your performance analytics appear after your first quiz attempt." />;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Attempts" value={data.totalAttempts} icon={<Play className="h-5 w-5" />} /><StatCard label="Average score" value={`${data.averagePercent}%`} icon={<Trophy className="h-5 w-5" />} tone="green" /><StatCard label="Best score" value={`${data.bestPercent}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone="amber" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-bold">Score trend (last 20)</h2><div className="h-64"><ResponsiveContainer><LineChart data={data.trend.map((t: any, i: number) => ({ n: i + 1, percent: t.percent, title: t.title }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="n" fontSize={12} /><YAxis domain={[0, 100]} fontSize={12} /><Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(_, p) => p?.[0]?.payload?.title} /><Line type="monotone" dataKey="percent" stroke="#2563EB" strokeWidth={2} dot /></LineChart></ResponsiveContainer></div></section>
        <section className="card p-5"><h2 className="mb-3 font-bold">Average by subject</h2><div className="h-64"><ResponsiveContainer><BarChart data={data.subjects}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="subject" fontSize={11} /><YAxis domain={[0, 100]} fontSize={12} /><Tooltip formatter={(v: number) => `${v}%`} /><Bar dataKey="average" fill="#2563EB" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
        <section className="card p-5 lg:col-span-2"><h2 className="mb-3 font-bold">Topics to revise</h2>{data.weakTopics.length === 0 ? <p className="text-sm text-slate-500">Topic data appears when questions are tagged with topics.</p> : (
          <ul className="space-y-3">{data.weakTopics.map((t: any) => <li key={t.topic}><div className="flex justify-between text-sm"><span className="font-medium capitalize">{t.topic}</span><span className="text-slate-500">{t.percent}% correct ({t.total} answered)</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className={cx('h-2 rounded-full', t.percent < 50 ? 'bg-red-500' : t.percent < 75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${t.percent}%` }} /></div></li>)}</ul>)}</section>
      </div>
    </>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<{ items: any[]; page: number; pages: number }>(`/quizzes/me/history?page=${page}`);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.items.length) return <EmptyState title="No attempts yet" />;
  return (
    <>
      <div className="card divide-y divide-slate-100">{data.items.map((a) => (
        <Link key={a._id} to={`/quizzes/result/${a._id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
          <div className="min-w-0"><p className="truncate font-medium">{a.quiz?.title || `Practice${a.topic ? `: ${a.topic}` : ''}`}</p><p className="text-xs text-slate-500">{a.subject?.name} · {formatDateTime(a.submittedAt)} · {fmtTime(a.timeTakenSec)}</p></div>
          <Badge tone={a.percent >= 40 ? 'green' : 'red'}>{a.score}/{a.total} · {a.percent}%</Badge></Link>))}</div>
      <Pagination page={data.page} pages={data.pages} onChange={setPage} />
    </>
  );
}

// ------------------------------------------------------------------ taking a quiz

export function QuizTake() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useApi<any>(`/quizzes/attempts/${attemptId}`);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  useTitle(data?.quiz?.title || 'Quiz');

  // Restore answers saved in this browser so an accidental refresh does not lose progress
  const storeKey = `ss_attempt_${attemptId}`;
  useEffect(() => { try { const s = localStorage.getItem(storeKey); if (s) setAnswers(JSON.parse(s)); } catch { /* ignore */ } }, [storeKey]);
  useEffect(() => { try { localStorage.setItem(storeKey, JSON.stringify(answers)); } catch { /* ignore */ } }, [answers, storeKey]);

  useEffect(() => { if (data && !data.inProgress) nav(`/quizzes/result/${attemptId}`, { replace: true }); }, [data, attemptId, nav]);

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true; setBusy(true);
    try {
      await api.post(`/quizzes/attempts/${attemptId}/submit`, { answers });
      try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
      if (auto) toast.ok("Time is up. Your answers were submitted.");
      nav(`/quizzes/result/${attemptId}`, { replace: true });
    } catch (e) { submitted.current = false; setBusy(false); toast.err(errMsg(e)); }
  }, [answers, attemptId, nav, storeKey, toast]);

  // countdown based on the server clock offset (so a wrong device clock cannot extend the exam)
  useEffect(() => {
    if (!data?.attempt?.deadline) return;
    const offset = new Date(data.serverTime).getTime() - Date.now();
    const tick = () => { const s = Math.round((new Date(data.attempt.deadline).getTime() - (Date.now() + offset)) / 1000); setLeft(s); if (s <= 0) submit(true); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data, submit]);

  const questions: any[] = data?.questions || [];
  const answered = useMemo(() => questions.filter((q) => answers[q._id] !== undefined).length, [questions, answers]);
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'Could not load the quiz'} />;
  if (!data.inProgress) return <PageLoader />;
  const q = questions[idx];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card sticky top-2 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="font-bold">{data.quiz?.title || `Practice${data.attempt.topic ? `: ${data.attempt.topic}` : ''}`}</p><p className="text-xs text-slate-500">{answered} of {questions.length} answered</p></div>
        {left !== null && <div className={cx('flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-lg font-bold', left < 60 ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700')} role="timer" aria-live="off"><Clock className="h-4 w-4" />{fmtTime(Math.max(0, left))}</div>}
      </div>
      {q && <div className="card p-6">
        <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Question {idx + 1} of {questions.length}{q.topic ? ` · ${q.topic}` : ''}</p>
        <h2 className="mb-5 whitespace-pre-line text-lg font-semibold">{q.text}</h2>
        <div className="space-y-2.5" role="radiogroup" aria-label="Options">{q.options.map((o: string, i: number) => (
          <button key={i} role="radio" aria-checked={answers[q._id] === i} onClick={() => setAnswers({ ...answers, [q._id]: i })} className={cx('flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition', answers[q._id] === i ? 'border-brand bg-brand-50 ring-1 ring-brand' : 'border-slate-200 hover:border-brand/50')}>
            <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', answers[q._id] === i ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500')}>{String.fromCharCode(65 + i)}</span><span className="pt-0.5">{o}</span></button>))}</div>
        <div className="mt-6 flex items-center justify-between">
          <button className="btn-outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
          {answers[q._id] !== undefined && <button className="text-xs text-slate-400 underline" onClick={() => { const a = { ...answers }; delete a[q._id]; setAnswers(a); }}>Clear answer</button>}
          {idx < questions.length - 1 ? <button className="btn-primary" onClick={() => setIdx(idx + 1)}>Next</button> : <button className="btn-primary" disabled={busy} onClick={() => { if (answered < questions.length && !window.confirm(`${questions.length - answered} question(s) are unanswered. Submit anyway?`)) return; submit(); }}><Flag className="h-4 w-4" /> Submit</button>}
        </div></div>}
      <div className="card mt-4 p-4"><p className="mb-2 text-xs font-semibold uppercase text-slate-400">Question palette</p><div className="flex flex-wrap gap-2">{questions.map((x, i) => (
        <button key={x._id} onClick={() => setIdx(i)} aria-label={`Go to question ${i + 1}`} className={cx('h-9 w-9 rounded-lg text-sm font-semibold', i === idx ? 'bg-brand text-white' : answers[x._id] !== undefined ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{i + 1}</button>))}</div>
        <button className="btn-soft mt-4 w-full" disabled={busy} onClick={() => { if (window.confirm('Submit your answers now?')) submit(); }}>Submit quiz</button></div>
    </div>
  );
}

// ------------------------------------------------------------------ result + answer review

export function QuizResult() {
  const { attemptId } = useParams();
  const { data, loading, error, reload } = useApi<any>(`/quizzes/attempts/${attemptId}`);
  useTitle('Quiz result');
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'Result not found'} onRetry={reload} />;
  if (data.inProgress) return <EmptyState title="This attempt is still in progress" action={<Link className="btn-primary" to={`/quizzes/take/${attemptId}`}>Continue</Link>} />;
  const a = data.attempt;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card mb-6 p-6 text-center">
        <p className="text-sm font-medium text-slate-500">{data.quiz?.title || `Practice${a.topic ? `: ${a.topic}` : ''}`}</p>
        <p className="mt-2 text-5xl font-extrabold text-brand">{a.percent}%</p>
        <p className="mt-1 text-slate-600">{a.score} of {a.total} correct · {fmtTime(a.timeTakenSec)}</p>
        {data.passed !== null && <div className="mt-3"><Badge tone={data.passed ? 'green' : 'red'}>{data.passed ? 'Passed' : 'Not passed'} (pass mark {data.quiz.passPercent}%)</Badge></div>}
        {data.timedOut && <p className="mt-2 text-sm text-red-600">Submitted after the time limit, so the answers were not counted.</p>}
        <div className="mt-5 flex justify-center gap-2"><Link to="/quizzes" className="btn-primary">Back to quiz center</Link></div>
      </div>
      <h2 className="mb-3 text-lg font-bold">Answer review</h2>
      <div className="space-y-4">{data.review.map((r: any, i: number) => (
        <div key={r._id} className="card p-5">
          <div className="mb-2 flex items-start gap-2">{r.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}<p className="font-semibold">{i + 1}. {r.text}</p></div>
          <ul className="space-y-1.5">{r.options.map((o: string, j: number) => (
            <li key={j} className={cx('rounded-lg px-3 py-2 text-sm', j === r.correctIndex ? 'bg-emerald-50 text-emerald-800' : j === r.selected ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600')}>
              <span className="font-bold">{String.fromCharCode(65 + j)}.</span> {o}{j === r.correctIndex && ' ✓ Correct answer'}{j === r.selected && j !== r.correctIndex && ' ✗ Your answer'}</li>))}</ul>
          {r.selected === null && <p className="mt-2 text-xs text-amber-600">You did not answer this question.</p>}
          {r.explanation && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-slate-700"><strong>Explanation: </strong>{r.explanation}</p>}
        </div>))}</div>
    </div>
  );
}
