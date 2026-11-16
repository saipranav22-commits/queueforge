import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getButtonStyles = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20';
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        <div className="flex items-start gap-3 pb-4">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg shadow-lg transition ${getButtonStyles()} disabled:opacity-50`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
