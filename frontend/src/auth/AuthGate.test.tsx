import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the Supabase client so the provider runs without network/env.
const signInWithPassword = vi.fn();
let authCallback: ((event: string, session: unknown) => void) | null = null;

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithPassword: (args: { email: string; password: string }) => signInWithPassword(args),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { AuthProvider } from './AuthProvider';
import AuthGate from './AuthGate';

function renderGate() {
  return render(
    <AuthProvider>
      <AuthGate>
        <div>SECRET CONTENT</div>
      </AuthGate>
    </AuthProvider>
  );
}

beforeEach(() => {
  signInWithPassword.mockReset();
  authCallback = null;
});

describe('AuthGate + login', () => {
  it('shows the login screen (not the app) when there is no session', async () => {
    renderGate();
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument();
  });

  it('submits email + password to Supabase', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderGate();
    await screen.findByRole('button', { name: /sign in/i });

    await userEvent.type(screen.getByLabelText(/email/i), 'alex@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 's3cret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 's3cret' })
    );
  });

  it('surfaces an auth error', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderGate();
    await screen.findByRole('button', { name: /sign in/i });

    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i);
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument();
  });

  it('bypasses the login gate entirely when VITE_AUTH_DISABLED=true', async () => {
    vi.stubEnv('VITE_AUTH_DISABLED', 'true');
    renderGate();
    expect(await screen.findByText('SECRET CONTENT')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it('renders the app once a session arrives', async () => {
    renderGate();
    await screen.findByRole('button', { name: /sign in/i });

    // Simulate Supabase emitting a signed-in session.
    authCallback?.('SIGNED_IN', { access_token: 'tok', user: { id: 'u1', email: 'alex@example.com' } });

    expect(await screen.findByText('SECRET CONTENT')).toBeInTheDocument();
  });
});
