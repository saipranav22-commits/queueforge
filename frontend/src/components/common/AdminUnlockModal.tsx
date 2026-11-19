import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, KeyRound, X, Loader2, AlertCircle } from 'lucide-react';

export const AdminUnlockModal: React.FC = () => {
  const { isUnlockModalOpen, closeUnlockModal, login } = useAuth();
  const [adminKey, setAdminKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isUnlockModalOpen && !isSubmitting) {
        closeUnlockModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlockModalOpen, isSubmitting, closeUnlockModal]);

  if (!isUnlockModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setErrorMsg('Please enter the administrative key');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await login(adminKey.trim());
      setAdminKey('');
    } catch (err: any) {
      if (err.status === 429) {
        setErrorMsg('Rate limit exceeded: Max 5 failed attempts reached. Please wait 60 seconds.');
      } else {
        setErrorMsg(err.message || 'Invalid administrative key.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-unlock-title"
        className="relative w-full max-w-md rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-6 shadow-2xl transition-colors"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--color-amber-bg)] text-[var(--color-amber)] border border-[var(--color-amber-border)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 id="admin-unlock-title" className="text-base font-bold text-[var(--color-text-primary)]">
                Unlock Admin Actions
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Authenticate for administrative replay and discard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeUnlockModal}
            aria-label="Close unlock modal"
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 font-mono">
              Admin API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter QF_ADMIN_API_KEY"
                autoFocus
                className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-amethyst)] focus:ring-1 focus:ring-[var(--color-amethyst)] font-mono transition"
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Sent securely to backend via HTTPS/SameSite session. Never cached on disk.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] text-[var(--color-crimson)] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={closeUnlockModal}
              className="px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[var(--color-amethyst)] hover:brightness-110 disabled:opacity-50 rounded-lg transition shadow-md shadow-[var(--color-amethyst)]/25"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Authenticate & Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
