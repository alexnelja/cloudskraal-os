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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-stone-200 z-50 flex">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 ${
              isActive ? 'text-emerald-700 font-medium' : 'text-stone-400'
            }`
          }
        >
          <tab.icon size={20} />
          <span className="text-[10px]">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
