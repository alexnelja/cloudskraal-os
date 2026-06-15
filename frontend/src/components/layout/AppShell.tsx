import { useState, useEffect } from 'react';
import { Plant, SignOut } from '@phosphor-icons/react';
import Sidebar from '../Sidebar';
import BottomNav from './BottomNav';
import CommandPalette from '../CommandPalette';
import QuickAddFAB from '../QuickAddFAB';
import { useAuth } from '../../auth/AuthProvider';

function initialsFromEmail(email?: string | null): string {
  if (!email) return '–';
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--md-sys-color-surface)' }}
    >
      {/* Mobile top app bar */}
      <header
        className="fixed top-0 w-full flex justify-between items-center px-4 h-14 backdrop-blur-xl z-40 md:hidden"
        style={{
          background: 'color-mix(in srgb, var(--md-sys-color-surface) 80%, transparent)',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            color: 'var(--md-sys-color-primary)',
            font: 'var(--md-sys-typescale-title-medium)',
          }}
        >
          <Plant size={20} weight="fill" />
          <span>Cloudskraal</span>
        </div>
        <button
          type="button"
          onClick={() => { void signOut(); }}
          title="Sign out"
          aria-label="Sign out"
          className="h-8 w-8 rounded-full flex items-center justify-center"
          style={{
            background: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
            font: 'var(--md-sys-typescale-label-medium)',
          }}
        >
          {initialsFromEmail(user?.email)}
        </button>
      </header>

      {/* Desktop sign-out */}
      <button
        type="button"
        onClick={() => { void signOut(); }}
        title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
        aria-label="Sign out"
        className="hidden md:flex fixed top-4 right-4 z-40 h-10 w-10 rounded-full items-center justify-center backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--md-sys-color-surface-container) 80%, transparent)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          color: 'var(--md-sys-color-on-surface-variant)',
        }}
      >
        <SignOut size={18} />
      </button>

      <Sidebar />
      <BottomNav />
      <main className="md:ml-[360px] mt-14 md:mt-0 pb-24 md:pb-0 transition-all duration-300">
        {children}
      </main>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <QuickAddFAB />
    </div>
  );
}
