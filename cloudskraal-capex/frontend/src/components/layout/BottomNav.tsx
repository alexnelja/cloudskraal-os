import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, CalendarDays, BookOpen, Menu } from 'lucide-react';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/map', icon: MapIcon, label: 'Map' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/wiki', icon: BookOpen, label: 'Wiki' },
  { to: '/projects', icon: Menu, label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-20 bg-[#f9f9f8] border-t border-[#bdc9c1]/15 shadow-lg rounded-t-2xl md:hidden pb-2">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            isActive
              ? 'flex flex-col items-center justify-center text-[#047857] bg-[#047857]/10 rounded-xl px-3 py-1.5 gap-0.5'
              : 'flex flex-col items-center justify-center text-[#78716c] gap-0.5'
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon size={20} />
              <span className="text-[11px] font-medium tracking-wide uppercase">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
