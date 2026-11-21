import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, KeyRound, X, Loader2, AlertCircle, Eye, EyeOff, HelpCircle } from 'lucide-react';

export const AdminUnlockModal: React.FC = () => {
  const { isUnlockModalOpen, closeUnlockModal, login } = useAuth();
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
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
    const trimmed = adminKey.trim();

    if (!trimmed) {
      setErrorMsg('Please enter the administrative API key.');
      return;
    }

    // Detect if user is attempting username:password syntax
    if (trimmed.includes(':') || trimmed.toLowerCase().startsWith('user:') || trimmed.toLowerCase().startsWith('admin:')) {
      setErrorMsg('QueueForge authenticates using an Administrator API Key (not a username and password). Please enter the administrative secret key directly.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await login(trimmed);
      setAdminKey('');
    } catch (err: any) {
      if (err.status === 429) {
        setErrorMsg('Rate limit exceeded: Max 5 failed attempts reached. Please wait 60 seconds.');
      } else if (err.status === 401) {
        setErrorMsg('Invalid administrative API key. Please check your QF_ADMIN_API_KEY environment variable or application configuration.');
      } else if (err.status === 403) {
        setErrorMsg('Access forbidden: Missing or invalid CSRF security token. Please refresh the page and try again.');
      } else if (err.status === 0 || err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('unavailable')) {
        setErrorMsg('Backend service unavailable (connection refused at http://127.0.0.1:8085). Please ensure the QueueForge backend is running.');
      } else if (err.status >= 500) {
        setErrorMsg(`Backend server error (${err.status}). The service may be initializing or overloaded. Please check server logs.`);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify your administrative credentials.');
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="admin-key-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] font-mono"
              >
                Admin API Key
              </label>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                No username/password needed
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="admin-key-input"
                type={showKey ? 'text' : 'password'}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter QF_ADMIN_API_KEY"
                autoFocus
                aria-describedby="admin-key-desc"
                aria-invalid={Boolean(errorMsg)}
                className="w-full pl-10 pr-10 py-2 text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] font-mono transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide administrative key' : 'Show administrative key'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div id="admin-key-desc" className="mt-2 p-2.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex items-start gap-2 text-[11px] text-[var(--color-text-muted)]">
              <HelpCircle className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
              <div>
                <span>
                  QueueForge uses an <strong>Administrator API Key</strong> (not username/password). In local development, configured in <code className="text-[var(--color-text-secondary)] font-mono">application.yml</code> under <code className="text-[var(--color-text-secondary)] font-mono">queueforge.admin.api-key</code>.
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[var(--color-crimson-bg)] border border-[var(--color-crimson-border)] text-[var(--color-crimson)] text-xs flex items-start gap-2"
            >
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
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition bg-[var(--color-action-bg)] text-[var(--color-action-text)] hover:bg-[var(--color-action-hover)] disabled:opacity-50"
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
