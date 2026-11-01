import { Link } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { formatDateTime, useApi, useTitle } from '../../lib/utils';
import { Badge, EmptyState, ErrorState, PageHeader, PageLoader, useToast } from '../../components/ui';

export default function ForumModeration() {
  useTitle('Forum moderation');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ discussions: any[]; replies: any[] }>('/forum/moderation/queue');
  const act = async (kind: string, id: string, action: string) => { try { await api.patch(`/forum/moderation/${kind}/${id}`, { action }); toast.ok('Done'); reload(); } catch (e) { toast.err(errMsg(e)); } };

  const Row = ({ kind, item, title, link }: { kind: 'discussion' | 'reply'; item: any; title: string; link: string }) => (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2"><Link className="font-semibold text-brand" to={link}>{title}</Link>{item.hidden && <Badge tone="red">Hidden</Badge>}{item.reports.length > 0 && <Badge tone="amber">{item.reports.length} report(s)</Badge>}</div>
      <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{item.body}</p>
      <p className="text-xs text-slate-400">By {item.author?.name} · {formatDateTime(item.createdAt)}</p>
      {item.reports.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-slate-500">{item.reports.map((r: any, i: number) => <li key={i}>{r.reason}</li>)}</ul>}
      <div className="mt-3 flex gap-2">{item.hidden ? <button className="btn-soft btn-sm" onClick={() => act(kind, item._id, 'unhide')}>Restore</button> : <button className="btn-outline btn-sm text-red-600" onClick={() => act(kind, item._id, 'hide')}>Hide</button>}
        {item.reports.length > 0 && <button className="btn-outline btn-sm" onClick={() => act(kind, item._id, 'dismiss')}>Dismiss reports</button>}</div>
    </div>
  );

  return (
    <>
      <PageHeader title="Forum moderation" subtitle="Reported or hidden discussions and replies. Hidden content is invisible to students." />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.discussions.length + data.replies.length === 0 ? <EmptyState title="Nothing to moderate" text="No reported or hidden content." /> : (
        <div className="space-y-6">
          {data.discussions.length > 0 && <section><h2 className="mb-2 font-bold">Discussions</h2><div className="space-y-3">{data.discussions.map((d) => <Row key={d._id} kind="discussion" item={d} title={d.title} link={`/forum/${d._id}`} />)}</div></section>}
          {data.replies.length > 0 && <section><h2 className="mb-2 font-bold">Replies</h2><div className="space-y-3">{data.replies.map((r) => <Row key={r._id} kind="reply" item={r} title={`Reply in: ${r.discussion?.title || 'deleted discussion'}`} link={r.discussion ? `/forum/${r.discussion._id}` : '/forum'} />)}</div></section>}
        </div>))}
    </>
  );
}
