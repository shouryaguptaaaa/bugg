import { useEffect, useState } from 'react';
import { FolderPlus, Star } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { cx, useApi } from '../lib/utils';
import { useToast } from './ui';

/** Student tools on the material page: reading progress, save to folder, rating. */
export function MaterialExtras({ id }: { id: string }) {
  const toast = useToast();
  const progress = useApi<{ percent: number }>(`/me/progress/${id}`);
  const folders = useApi<{ items: { _id: string; name: string }[] }>('/me/folders');
  const reviews = useApi<{ average: number; count: number; mine: { rating: number; comment: string } | null }>(`/materials/${id}/reviews`);
  const [pct, setPct] = useState(0);
  const [folder, setFolder] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  useEffect(() => { if (progress.data) setPct(progress.data.percent); }, [progress.data]);
  useEffect(() => { if (reviews.data?.mine) { setRating(reviews.data.mine.rating); setComment(reviews.data.mine.comment); } }, [reviews.data]);

  const savePct = async (v: number) => { try { await api.put(`/me/progress/${id}`, { percent: v }); toast.ok('Progress saved'); } catch (e) { toast.err(errMsg(e)); } };
  const addToFolder = async () => { try { const r = await api.post(`/me/folders/${folder}/materials`, { material: id }); toast.ok(r.message); } catch (e) { toast.err(errMsg(e)); } };
  const createFolder = async () => {
    const name = window.prompt('New folder name'); if (!name?.trim()) return;
    try { const f = await api.post('/me/folders', { name }); await api.post(`/me/folders/${f._id}/materials`, { material: id }); toast.ok(`Saved to "${f.name}"`); folders.reload(); } catch (e) { toast.err(errMsg(e)); }
  };
  const saveReview = async () => { try { await api.put(`/materials/${id}/reviews`, { rating, comment }); toast.ok('Thanks for your rating'); reviews.reload(); } catch (e) { toast.err(errMsg(e)); } };

  return (
    <div className="card space-y-5 p-6">
      <div>
        <label htmlFor="progress" className="mb-1 flex justify-between text-sm font-semibold"><span>Reading progress</span><span>{pct}%</span></label>
        <input id="progress" type="range" min={0} max={100} step={5} className="w-full accent-brand" value={pct} onChange={(e) => setPct(Number(e.target.value))} onMouseUp={() => savePct(pct)} onTouchEnd={() => savePct(pct)} onKeyUp={() => savePct(pct)} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">Save to folder</p>
        <div className="flex gap-2"><select className="input" aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}><option value="">Choose folder</option>{folders.data?.items.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}</select>
          <button className="btn-soft" disabled={!folder} onClick={addToFolder}>Save</button></div>
        <button className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand" onClick={createFolder}><FolderPlus className="h-3.5 w-3.5" /> New folder</button>
      </div>
      <div>
        <p className="mb-1 flex justify-between text-sm font-semibold"><span>Rate this material</span>{reviews.data && reviews.data.count > 0 && <span className="font-normal text-slate-500">{reviews.data.average} / 5 ({reviews.data.count})</span>}</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}><Star className={cx('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} /></button>)}</div>
        <input className="input mt-2" maxLength={500} placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="btn-outline mt-2 w-full" disabled={!rating} onClick={saveReview}>{reviews.data?.mine ? 'Update rating' : 'Submit rating'}</button>
      </div>
    </div>
  );
}
