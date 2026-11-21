import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface RouteMetadata {
  zone: string;
  name: string;
}

const ROUTE_MAP: Record<string, RouteMetadata> = {
  '/': { zone: 'MISSION CONTROL', name: 'Overview' },
  '/jobs': { zone: 'WORKLOADS', name: 'Job Explorer' },
  '/workers': { zone: 'WORKLOADS', name: 'Worker Fleet' },
  '/fairshare': { zone: 'WORKLOADS', name: 'FairShare Scheduler' },
  '/pipeline': { zone: 'RELIABILITY', name: 'Event Pipeline' },
  '/reliability': { zone: 'RELIABILITY', name: 'Reliability Lab' },
  '/dlq': { zone: 'RELIABILITY', name: 'Dead-Letter Queue' },
  '/monitoring': { zone: 'OPERATIONS', name: 'Observability' },
  '/admin': { zone: 'OPERATIONS', name: 'Administration' },
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  let meta = ROUTE_MAP[path];
  let subDetail: string | null = null;

  if (!meta && path.startsWith('/jobs/')) {
    meta = { zone: 'WORKLOADS', name: 'Job Explorer' };
    subDetail = path.replace('/jobs/', '');
  }

  if (!meta) {
    meta = { zone: 'COMMAND', name: 'Overview' };
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs select-none">
      <Link
        to="/"
        className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        title="Mission Control Home"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      <ChevronRight className="w-3 h-3 text-[var(--color-border-interactive)] opacity-60" />
      <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--color-cyan)] font-semibold px-1 py-0.5 rounded bg-[var(--color-cyan-bg)] border border-[var(--color-cyan-border)]">
        {meta.zone}
      </span>
      <ChevronRight className="w-3 h-3 text-[var(--color-border-interactive)] opacity-60" />
      <span className="font-medium text-[var(--color-text-primary)]">
        {meta.name}
      </span>
      {subDetail && (
        <>
          <ChevronRight className="w-3 h-3 text-[var(--color-border-interactive)] opacity-60" />
          <span className="font-mono text-[11px] text-[var(--color-amethyst)] bg-[var(--color-amethyst-bg)] px-1.5 py-0.5 rounded border border-[var(--color-amethyst-border)]">
            #{subDetail.slice(0, 8)}
          </span>
        </>
      )}
    </nav>
  );
};
