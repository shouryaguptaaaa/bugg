import { Link } from 'react-router-dom';
import { Download, Eye, FileText, FileImage, FileVideo, FileArchive, FileSpreadsheet, Presentation } from 'lucide-react';
import type { Material } from '../lib/types';
import { FILE_COLORS, cx, formatBytes } from '../lib/utils';
import { api } from '../lib/api';

export function FileIcon({ ext, className }: { ext: string; className?: string }) {
  const c = cx('h-6 w-6', className);
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return <FileImage className={c} />;
  if (ext === '.mp4') return <FileVideo className={c} />;
  if (ext === '.zip') return <FileArchive className={c} />;
  if (['.xls', '.xlsx'].includes(ext)) return <FileSpreadsheet className={c} />;
  if (['.ppt', '.pptx'].includes(ext)) return <Presentation className={c} />;
  return <FileText className={c} />;
}

export function MaterialCard({ m }: { m: Material }) {
  const isImg = ['.jpg', '.jpeg', '.png'].includes(m.file.ext);
  return (
    <Link to={`/materials/${m._id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={cx('flex h-28 items-center justify-center', FILE_COLORS[m.file.ext] || 'bg-slate-50 text-slate-500')}>
        {isImg ? (
          <img src={api.url(`/materials/${m._id}/thumbnail`)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="text-center">
            <FileIcon ext={m.file.ext} className="mx-auto h-9 w-9" />
            <span className="mt-1 block text-xs font-bold uppercase">{m.file.ext.replace('.', '')}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-xs font-medium text-brand-700">{m.category?.name}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand">{m.title}</h3>
        <p className="mt-1 truncate text-xs text-slate-500">
          {m.subject?.name}
          {m.semester ? ` · ${m.semester.name}` : ''}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {m.views}</span>
          <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {m.downloads}</span>
          <span className="ml-auto">{formatBytes(m.file.size)}</span>
        </div>
      </div>
    </Link>
  );
}
