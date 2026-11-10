import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Lock, Key } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export const LoginView: React.FC = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (token: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(
        err?.message || 'Administrator authorization failed. Please check your credentials.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please provide an administrator bearer token.');
      return;
    }
    handleLogin(tokenInput.trim());
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-6 text-zinc-100">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-lg p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded bg-white flex items-center justify-center text-black font-black text-sm">
            CM
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">CAL METER</h1>
            <p className="text-xs text-zinc-400">Internal Operations & Administration Platform</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-zinc-500" />
              Administrator Auth Token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Paste Firebase Admin ID Bearer Token"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-white hover:bg-zinc-200 text-black font-medium text-xs rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-900">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">
            Local Developer / Test Credentials
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Super Admin', token: 'token-super-admin' },
              { label: 'Ops Admin', token: 'token-ops-admin' },
              { label: 'Nutrition Editor', token: 'token-nutrition-editor' },
              { label: 'Support Admin', token: 'token-support-admin' },
            ].map(persona => (
              <button
                key={persona.label}
                type="button"
                onClick={() => {
                  setTokenInput(persona.token);
                  handleLogin(persona.token);
                }}
                className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] text-zinc-300 text-left transition-colors flex items-center justify-between"
              >
                <span>{persona.label}</span>
                <span className="text-zinc-600 font-mono">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-600">
          CAL METER Production Administration • Authorized Personnel Only
        </div>
      </div>
    </div>
  );
};
