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
    <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 sm:px-6 bg-slate-900/40 rounded-b-xl">
      <div className="text-xs text-slate-400">
        Showing <span className="font-medium text-slate-200">{startIdx}</span> to{' '}
        <span className="font-medium text-slate-200">{endIdx}</span> of{' '}
        <span className="font-medium text-slate-200">{totalElements}</span> results
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 rounded-lg border border-slate-700 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <span className="text-xs text-slate-400 font-mono px-2">
          Page {currentPage + 1} of {Math.max(1, totalPages)}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 rounded-lg border border-slate-700 transition"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
