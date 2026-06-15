/**
 * Renders the login screen until there is a Supabase session, then the app.
 */
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import LoginPage from './LoginPage';
import LoadingOverlay from '../components/ui/LoadingOverlay';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <LoadingOverlay variant="spinner" />;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}
