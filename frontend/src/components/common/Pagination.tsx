import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
}) => {
  if (totalElements === 0) return null;

  const startIdx = currentPage * pageSize + 1;
  const endIdx = Math.min((currentPage + 1) * pageSize, totalElements);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] px-4 py-3 sm:px-6 bg-[var(--color-bg-deep)] rounded-b-xl transition-colors font-mono">
      <div className="text-xs text-[var(--color-text-muted)]">
        Showing <span className="font-bold text-[var(--color-text-primary)]">{startIdx}</span> to{' '}
        <span className="font-bold text-[var(--color-text-primary)]">{endIdx}</span> of{' '}
        <span className="font-bold text-[var(--color-text-primary)]">{totalElements}</span> results
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] disabled:opacity-40 disabled:hover:bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)] transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <span className="text-xs text-[var(--color-text-muted)] px-2">
          Page {currentPage + 1} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-interactive)] disabled:opacity-40 disabled:hover:bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)] transition"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
