/**
 * Renders the login screen until there is a Supabase session, then the app.
 */
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import LoginPage from './LoginPage';
import LoadingOverlay from '../components/ui/LoadingOverlay';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  // Mirror of the backend AUTH_DISABLED flag. When true, the login gate is
  // skipped entirely (the backend must also have AUTH_DISABLED=true so its /api
  // gate is off too). Use until the Supabase operator user exists. Read at
  // render time so it can be toggled per-test.
  if (import.meta.env.VITE_AUTH_DISABLED === 'true') return <>{children}</>;
  if (loading) return <LoadingOverlay variant="spinner" />;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
