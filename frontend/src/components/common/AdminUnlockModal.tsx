import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, KeyRound, X, Loader2, AlertCircle } from 'lucide-react';

export const AdminUnlockModal: React.FC = () => {
  const { isUnlockModalOpen, closeUnlockModal, login } = useAuth();
  const [adminKey, setAdminKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Unlock Admin Actions</h3>
              <p className="text-xs text-slate-400">Authenticate for administrative replay and discard</p>
            </div>
          </div>
          <button
            onClick={closeUnlockModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Admin API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter QF_ADMIN_API_KEY"
                autoFocus
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Sent securely to backend via HTTPS/SameSite session. Never cached on disk.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeUnlockModal}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition shadow-lg shadow-blue-600/20"
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
