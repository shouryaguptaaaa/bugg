import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useTitle } from '../../lib/utils';
import type { Material, Paged } from '../../lib/types';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { MaterialCard } from '../../components/MaterialCard';

export default function Bookmarks() {
  useTitle('Bookmarks');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi<Paged<Material>>(`/me/bookmarks?page=${page}`);
  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Materials you saved for later." />
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.items.length === 0 ? (
        <EmptyState title="No bookmarks yet" text="Open any material and tap Bookmark to keep it here." action={<Link to="/library" className="btn-primary">Browse library</Link>} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.items.map((m) => <MaterialCard key={m._id} m={m} />)}</div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ))}
    </>
  );
}
