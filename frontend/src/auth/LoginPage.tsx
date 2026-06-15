/**
 * Email + password login. Single-operator app — create the user in the Supabase
 * dashboard (Authentication → Users). No public sign-up.
 */
import { useState } from 'react';
import { Plant } from '@phosphor-icons/react';
import { useAuth } from './AuthProvider';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--md-sys-color-surface)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col gap-5"
        style={{
          background: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{ color: 'var(--md-sys-color-primary)', font: 'var(--md-sys-typescale-title-large)' }}
        >
          <Plant size={28} weight="fill" />
          <span>Cloudskraal</span>
        </div>

        <div style={{ color: 'var(--md-sys-color-on-surface-variant)', font: 'var(--md-sys-typescale-body-medium)' }}>
          Sign in to continue
        </div>

        <label className="flex flex-col gap-1">
          <span style={{ font: 'var(--md-sys-typescale-label-medium)', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline)',
              color: 'var(--md-sys-color-on-surface)',
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span style={{ font: 'var(--md-sys-typescale-label-medium)', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'var(--md-sys-color-surface)',
              border: '1px solid var(--md-sys-color-outline)',
              color: 'var(--md-sys-color-on-surface)',
            }}
          />
        </label>

        {error && (
          <div role="alert" style={{ color: 'var(--md-sys-color-error)', font: 'var(--md-sys-typescale-body-small)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full px-4 py-2.5 transition-opacity disabled:opacity-60"
          style={{
            background: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            font: 'var(--md-sys-typescale-label-large)',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
