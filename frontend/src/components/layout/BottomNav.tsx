import { NavLink } from 'react-router-dom';
import { SquaresFour, MapTrifold, CheckSquare, CalendarBlank, BookOpen } from '@phosphor-icons/react';

const tabs = [
  { to: '/', icon: SquaresFour, label: 'Home' },
  { to: '/map', icon: MapTrifold, label: 'Map' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/calendar', icon: CalendarBlank, label: 'Calendar' },
  { to: '/wiki', icon: BookOpen, label: 'Wiki' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-20 bg-white/80 backdrop-blur-xl rounded-t-2xl md:hidden pb-2"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            aria-label={tab.label}
            className={({ isActive }) =>
              isActive
                ? 'flex flex-col items-center justify-center text-white bg-gradient-to-br from-[#005d42] to-[#047857] rounded-xl px-3 py-1.5 gap-0.5 min-w-[44px] min-h-[44px]'
                : 'flex flex-col items-center justify-center text-[#78716c] gap-0.5 min-w-[44px] min-h-[44px]'
            }
          >
            <Icon size={20} weight="duotone" />
            <span className="text-[10px] font-medium tracking-wide uppercase">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
