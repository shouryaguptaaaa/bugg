import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi, useTitle } from '../../lib/utils';
import { EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';

interface A {
  dailyDownloads: { date: string; value: number }[];
  activeStudents: { date: string; value: number }[];
  registrations: { date: string; value: number }[];
  topViewed: { _id: string; title: string; count: number }[];
  topDownloaded: { _id: string; title: string; count: number }[];
  popularSubjects: { _id: string; name: string; count: number }[];
  monthlyUploads: { month: string; count: number }[];
  storageMonthly: { month: string; mb: number }[];
}

const BLUE = '#2563EB';
const GRID = '#E2E8F0';

function Chart({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: ReactNode; empty?: boolean }) {
  return (
    <section className="card p-5">
      <h2 className="font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 h-64">{empty ? <div className="flex h-full items-center justify-center text-sm text-slate-400">No data in this period</div> : <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>}</div>
    </section>
  );
}

const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const trim = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

function LineBlock({ data, title, subtitle, name }: { data: { date: string; value: number }[]; title: string; subtitle?: string; name: string }) {
  return (
    <Chart title={title} subtitle={subtitle} empty={data.every((d) => d.value === 0)}>
      <LineChart data={data} margin={{ left: -20, right: 8, top: 5 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [v as number, name]} />
        <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2.5} dot={false} />
      </LineChart>
    </Chart>
  );
}

function BarBlock({ data, x, y, title, subtitle, name, horizontal }: { data: any[]; x: string; y: string; title: string; subtitle?: string; name: string; horizontal?: boolean }) {
  return (
    <Chart title={title} subtitle={subtitle} empty={data.length === 0}>
      {horizontal ? (
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 12 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey={x} width={130} tick={{ fontSize: 11 }} tickFormatter={trim} />
          <Tooltip formatter={(v) => [v as number, name]} />
          <Bar dataKey={y} fill={BLUE} radius={[0, 6, 6, 0]} />
        </BarChart>
      ) : (
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [v as number, name]} />
          <Bar dataKey={y} fill={BLUE} radius={[6, 6, 0, 0]} />
        </BarChart>
      )}
    </Chart>
  );
}

export default function Analytics() {
  useTitle('Analytics');
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = preset === 'custom' ? (from && to ? `from=${from}&to=${to}` : null) : `days=${preset}`;
  const { data, loading, error, reload } = useApi<A>(qs ? `/admin/analytics?${qs}` : null);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Calculated from real downloads, views, uploads and registrations." />
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex gap-1.5" role="group" aria-label="Date range">
          {[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['custom', 'Custom']].map(([v, l]) => (
            <button key={v} className={preset === v ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setPreset(v)}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <div><label className="label !mb-1 text-xs">From</label><input type="date" className="input !py-1.5" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label !mb-1 text-xs">To</label><input type="date" className="input !py-1.5" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
      </div>
      {!qs && <EmptyState title="Choose a date range" text="Pick both a start and an end date." />}
      {loading && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <LineBlock data={data.dailyDownloads} title="Daily downloads" name="Downloads" />
          <LineBlock data={data.activeStudents} title="Active students" subtitle="Distinct signed-in students who opened a material each day" name="Active students" />
          <LineBlock data={data.registrations} title="User registration trend" name="New students" />
          <BarBlock data={data.monthlyUploads} x="month" y="count" title="Monthly uploads" name="Uploads" />
          <BarBlock data={data.popularSubjects} x="name" y="count" title="Popular subjects" subtitle="By downloads in this period" name="Downloads" horizontal />
          <BarBlock data={data.storageMonthly} x="month" y="mb" title="Storage consumption" subtitle="MB added per month" name="MB" />
          <BarBlock data={data.topViewed} x="title" y="count" title="Most viewed materials" name="Views" horizontal />
          <BarBlock data={data.topDownloaded} x="title" y="count" title="Most downloaded materials" name="Downloads" horizontal />
        </div>
      )}
    </>
  );
}
