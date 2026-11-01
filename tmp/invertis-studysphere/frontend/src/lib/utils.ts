import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from './api';

export function formatBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export const formatDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const formatDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Fetch hook with loading / error / reload. Pass null to skip. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api.get<T>(path);
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    load();
  }, [path, load]);

  return { data, loading, error, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Invertis StudySphere` : 'Invertis StudySphere';
  }, [title]);
}

export const FILE_COLORS: Record<string, string> = {
  '.pdf': 'bg-red-50 text-red-600',
  '.doc': 'bg-blue-50 text-blue-600',
  '.docx': 'bg-blue-50 text-blue-600',
  '.ppt': 'bg-orange-50 text-orange-600',
  '.pptx': 'bg-orange-50 text-orange-600',
  '.xls': 'bg-green-50 text-green-600',
  '.xlsx': 'bg-green-50 text-green-600',
  '.zip': 'bg-yellow-50 text-yellow-700',
  '.jpg': 'bg-purple-50 text-purple-600',
  '.jpeg': 'bg-purple-50 text-purple-600',
  '.png': 'bg-purple-50 text-purple-600',
  '.mp4': 'bg-pink-50 text-pink-600',
};
