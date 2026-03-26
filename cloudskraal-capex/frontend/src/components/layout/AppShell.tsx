import Sidebar from '../Sidebar';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar />
      <BottomNav />
      <main className="md:ml-64 pb-20 md:pb-0 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
