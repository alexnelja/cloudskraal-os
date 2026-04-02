import { useState, useEffect } from 'react';
import { Wheat } from 'lucide-react';
import Sidebar from '../Sidebar';
import BottomNav from './BottomNav';
import CommandPalette from '../CommandPalette';
import QuickAddFAB from '../QuickAddFAB';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Mobile top bar */}
      <header className="fixed top-0 w-full flex justify-between items-center px-4 h-14 bg-white/80 backdrop-blur-xl z-40 md:hidden">
        <div className="flex items-center gap-2 text-[#005d42] font-bold">
          <Wheat size={20} />
          <span className="text-base font-semibold tracking-tight">Cloudskraal</span>
        </div>
        <div className="h-8 w-8 rounded-full bg-[#047857]/10 flex items-center justify-center text-[#047857] text-xs font-bold">
          AN
        </div>
      </header>

      <Sidebar />
      <BottomNav />
      <main className="md:ml-64 mt-14 md:mt-0 pb-24 md:pb-0 transition-all duration-300">
        {children}
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <QuickAddFAB />
    </div>
  );
}
