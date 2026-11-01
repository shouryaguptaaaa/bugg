import { useAuth } from '../lib/auth';
import { cx } from '../lib/utils';

/** SHOURYA VEXORA logo placeholder. Replace by pasting the official logo URL into Admin > Website Settings > Logo URL. */
export function VexoraLogo({ size = 40, className }: { size?: number; className?: string }) {
  const { settings } = useAuth();
  const url = settings?.company.logoUrl;
  if (url) return <img src={url} alt={`${settings?.company.name} logo`} width={size} height={size} className={cx('rounded-xl object-contain', className)} />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SHOURYA VEXORA logo placeholder" className={className}>
      <defs>
        <linearGradient id="vx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E40AF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#vx)" />
      <path d="M16 18l16 30 16-30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 18l8 15 8-15" fill="none" stroke="#BFDBFE" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#2563EB" />
      <path d="M20 40c0 4 4 7 12 7s12-3 12-7-4-5-12-7-12-3-12-8 4-7 12-7 12 3 12 7" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function SiteName({ className }: { className?: string }) {
  const { settings } = useAuth();
  return <span className={cx('font-extrabold tracking-tight', className)}>{settings?.siteName || 'Invertis StudySphere'}</span>;
}
