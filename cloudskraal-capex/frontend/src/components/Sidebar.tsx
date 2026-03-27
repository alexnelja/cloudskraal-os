import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  Wheat,
  Map as MapIcon,
  CalendarDays,
  BookOpen,
  Wrench,
  Beef,
  Factory,
  Users,
  Package,
  BarChart3,
} from 'lucide-react';

const navGroups = [
  {
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/map', icon: MapIcon, label: 'Farm Map' },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
      { to: '/wiki', icon: BookOpen, label: 'Wiki' },
    ],
  },
  {
    items: [
      { to: '/equipment', icon: Wrench, label: 'Equipment' },
      { to: '/livestock', icon: Beef, label: 'Livestock' },
      { to: '/production', icon: Factory, label: 'Production' },
    ],
  },
  {
    items: [
      { to: '/employees', icon: Users, label: 'Employees' },
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/financials', icon: BarChart3, label: 'Financials' },
      { to: '/projects', icon: FolderOpen, label: 'CapEx' },
      { to: '/compare', icon: GitCompare, label: 'Compare' },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-emerald-800 text-white hidden md:flex flex-col transition-all duration-300 z-50 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-emerald-700">
        <div className="flex-shrink-0 w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
          <Wheat size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold leading-tight tracking-wide">Cloudskraal</h1>
            <p className="text-[10px] text-emerald-300 leading-tight">Boerderye</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {groupIdx > 0 && (
              <div className="my-3" />
            )}
            {group.items.map((item) => (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gradient-to-br from-[#005d42] to-[#047857] text-white font-medium'
                        : 'text-emerald-200 hover:bg-emerald-700/50 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </NavLink>
                {(item.to === '/wiki' || item.to === '/production') && (
                  <div className="mt-2" />
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-4 border-t border-emerald-700 text-emerald-300 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
