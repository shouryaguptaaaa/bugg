import { useState } from 'react';
import { Edit3, ListPlus, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { cx, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, useToast } from '../../components/ui';

const CAT: Record<string, string> = { mock_test: 'Mock test', practice: 'Practice', topic_test: 'Topic test', weekly: 'Weekly quiz', other: 'Other' };
const blankQuiz = { title: '', description: '', category: 'mock_test', subject: '', durationMinutes: 30, passPercent: 40, randomize: true };
const blankQ = { text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', topic: '' };

export default function ManageQuizzes() {
  useTitle('Manage quizzes');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: any[] }>('/quizzes/manage/list');
  const subjects = useApi<{ items: any[] }>('/academic/subjects');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<any>(blankQuiz);
  const [busy, setBusy] = useState(false);
  const [qz, setQz] = useState<any | null>(null); // quiz whose questions are being edited

  const openNew = () => { setEditing(null); setF(blankQuiz); setOpen(true); };
  const openEdit = (q: any) => { setEditing(q); setF({ title: q.title, description: q.description || '', category: q.category, subject: q.subject?._id || '', durationMinutes: q.durationMinutes, passPercent: q.passPercent, randomize: q.randomize }); setOpen(true); };
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, durationMinutes: Number(f.durationMinutes), passPercent: Number(f.passPercent) };
      if (editing) await api.patch(`/quizzes/${editing._id}`, body); else { const q = await api.post('/quizzes', body); setQz(q); }
      toast.ok('Quiz saved'); setOpen(false); reload();
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const publish = async (q: any) => { try { await api.patch(`/quizzes/${q._id}`, { published: !q.published }); toast.ok(q.published ? 'Quiz unpublished' : 'Quiz published and students notified'); reload(); } catch (e) { toast.err(errMsg(e)); } };
  const del = async (q: any) => { if (!window.confirm(`Delete "${q.title}" with all its questions and attempts?`)) return; try { await api.del(`/quizzes/${q._id}`); toast.ok('Deleted'); reload(); } catch (e) { toast.err(errMsg(e)); } };

  return (
    <>
      <PageHeader title="Quizzes & mock tests" subtitle="Create multiple-choice quizzes, add questions, then publish them to students." actions={<button className="btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> New quiz</button>} />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? <EmptyState title="No quizzes yet" action={<button className="btn-primary" onClick={openNew}>Create the first quiz</button>} /> : (
        <div className="card divide-y divide-slate-100">{data.items.map((q) => (
          <div key={q._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{q.title}</p><Badge tone={q.published ? 'green' : 'slate'}>{q.published ? 'Published' : 'Draft'}</Badge><Badge tone="blue">{CAT[q.category]}</Badge></div>
              <p className="text-xs text-slate-500">{q.subject?.name} · {q.questionCount} questions · {q.durationMinutes} min · pass {q.passPercent}% · {q.attempts} attempts</p></div>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn-soft btn-sm" onClick={() => setQz(q)}><ListPlus className="h-3.5 w-3.5" /> Questions</button>
              <button className="btn-outline btn-sm" onClick={() => publish(q)}>{q.published ? 'Unpublish' : 'Publish'}</button>
              <button className="btn-outline btn-sm" onClick={() => openEdit(q)} aria-label="Edit quiz"><Edit3 className="h-3.5 w-3.5" /></button>
              <button className="btn-outline btn-sm text-red-600" onClick={() => del(q)} aria-label="Delete quiz"><Trash2 className="h-3.5 w-3.5" /></button></div>
          </div>))}</div>))}

      <Modal open={open} title={editing ? 'Edit quiz' : 'New quiz'} onClose={() => setOpen(false)} wide>
        <div className="space-y-4">
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description (optional)"><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject"><select className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option value="">Select subject</option>{subjects.data?.items.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <Field label="Type"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Time limit (minutes)"><input type="number" min={1} max={360} className="input" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} /></Field>
            <Field label="Pass mark (%)"><input type="number" min={0} max={100} className="input" value={f.passPercent} onChange={(e) => setF({ ...f, passPercent: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.randomize} onChange={(e) => setF({ ...f, randomize: e.target.checked })} /> Randomise question order for each student</label>
          <div className="flex justify-end gap-2"><button className="btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy || f.title.trim().length < 3 || !f.subject} onClick={save}>{editing ? 'Save' : 'Create & add questions'}</button></div>
        </div>
      </Modal>
      {qz && <QuestionEditor quiz={qz} onClose={() => { setQz(null); reload(); }} />}
    </>
  );
}

function QuestionEditor({ quiz, onClose }: { quiz: any; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ quiz: any; questions: any[] }>(`/quizzes/${quiz._id}/manage`);
  const [f, setF] = useState<any>(blankQ);
  const [editId, setEditId] = useState<string | null>(null);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = f.text.trim().length >= 3 && f.options.filter((o: string) => o.trim()).length >= 2 && f.options[f.correctIndex]?.trim();

  const save = async () => {
    setBusy(true);
    try {
      // keep correctIndex aligned after removing blank options
      const kept = f.options.map((o: string, i: number) => ({ o: o.trim(), i })).filter((x: any) => x.o);
      const body = { text: f.text, options: kept.map((x: any) => x.o), correctIndex: kept.findIndex((x: any) => x.i === f.correctIndex), explanation: f.explanation, topic: f.topic };
      if (editId) await api.patch(`/quizzes/questions/${editId}`, body); else await api.post(`/quizzes/${quiz._id}/questions`, body);
      setF(blankQ); setEditId(null); reload(); toast.ok('Question saved');
    } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  const importBulk = async () => {
    try { const arr = JSON.parse(bulk); const r = await api.post(`/quizzes/${quiz._id}/questions`, arr); toast.ok(`${r.items.length} questions added`); setBulk(''); reload(); } catch (e) { toast.err(e instanceof SyntaxError ? 'That is not valid JSON' : errMsg(e)); }
  };
  const del = async (id: string) => { try { await api.del(`/quizzes/questions/${id}`); reload(); } catch (e) { toast.err(errMsg(e)); } };

  return (
    <Modal open title={`Questions: ${quiz.title}`} onClose={onClose} wide>
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="mb-5 max-h-64 space-y-2 overflow-y-auto">{data.questions.length === 0 && <p className="text-sm text-slate-500">No questions yet. Add the first one below.</p>}
          {data.questions.map((q, i) => (
            <div key={q._id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-medium">{i + 1}. {q.text}</p>
              <span className="flex shrink-0 gap-2"><button className="text-brand" onClick={() => { setEditId(q._id); setF({ text: q.text, options: [...q.options, '', '', '', '', '', ''].slice(0, Math.max(4, q.options.length)), correctIndex: q.correctIndex, explanation: q.explanation || '', topic: q.topic || '' }); }}>Edit</button><button className="text-red-600" onClick={() => del(q._id)}>Delete</button></span></div>
              <ul className="mt-1 text-xs text-slate-500">{q.options.map((o: string, j: number) => <li key={j} className={cx(j === q.correctIndex && 'font-semibold text-emerald-600')}>{String.fromCharCode(65 + j)}. {o}</li>)}</ul></div>))}</div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <h3 className="font-bold">{editId ? 'Edit question' : 'Add a question'}</h3>
          <textarea className="input" rows={2} placeholder="Question text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          {f.options.map((o: string, i: number) => (
            <div key={i} className="flex items-center gap-2"><input type="radio" name="correct" checked={f.correctIndex === i} onChange={() => setF({ ...f, correctIndex: i })} aria-label={`Option ${i + 1} is correct`} />
              <input className="input" placeholder={`Option ${String.fromCharCode(65 + i)}${i < 2 ? '' : ' (optional)'}`} value={o} onChange={(e) => setF({ ...f, options: f.options.map((x: string, j: number) => (j === i ? e.target.value : x)) })} /></div>))}
          {f.options.length < 6 && <button className="text-xs font-semibold text-brand" onClick={() => setF({ ...f, options: [...f.options, ''] })}>+ Add option</button>}
          <p className="text-xs text-slate-500">Select the radio button next to the correct answer.</p>
          <div className="grid gap-3 sm:grid-cols-2"><input className="input" placeholder="Topic (for topic-wise practice)" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /><input className="input" placeholder="Explanation (shown after the quiz)" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></div>
          <div className="flex gap-2"><button className="btn-primary" disabled={busy || !valid} onClick={save}>{editId ? 'Update question' : 'Add question'}</button>{editId && <button className="btn-outline" onClick={() => { setEditId(null); setF(blankQ); }}>Cancel edit</button>}</div>
        </div>
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Bulk add from JSON</summary>
          <textarea className="input mt-2 font-mono text-xs" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'[{"text":"2 + 2 = ?","options":["3","4","5"],"correctIndex":1,"topic":"arithmetic","explanation":"Basic addition"}]'} />
          <button className="btn-outline mt-2" disabled={!bulk.trim()} onClick={importBulk}>Import questions</button></details>
      </>}
    </Modal>
  );
}
