import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBytes, formatDateTime, useApi, useTitle } from '../../lib/utils';
import type { Material, Paged } from '../../lib/types';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { api } from '../../lib/api';
import { Download } from 'lucide-react';

export default function Downloads() {
  useTitle('Download history');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<Paged<{ _id: string; at: string; material: Material | null }>>(`/me/downloads?page=${page}`);
  return (
    <>
      <PageHeader title="Download history" subtitle="Everything you have downloaded, newest first." />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? (
        <EmptyState title="No downloads yet" text="Materials you download will be listed here." action={<Link to="/library" className="btn-primary">Browse library</Link>} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-slate-100 bg-slate-50"><tr><th className="th">Material</th><th className="th">Subject</th><th className="th">Size</th><th className="th">Downloaded</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r._id}>
                    <td className="td font-medium">{r.material ? <Link className="hover:text-brand" to={`/materials/${r.material._id}`}>{r.material.title}</Link> : <span className="text-slate-400">Removed material</span>}</td>
                    <td className="td text-slate-500">{r.material?.subject?.name || '-'}</td>
                    <td className="td text-slate-500">{r.material ? formatBytes(r.material.file.size) : '-'}</td>
                    <td className="td text-slate-500">{formatDateTime(r.at)}</td>
                    <td className="td text-right">{r.material && <a className="btn-soft btn-sm" href={api.url(`/materials/${r.material._id}/download`)}><Download className="h-3.5 w-3.5" /> Again</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}
    </>
  );
}
