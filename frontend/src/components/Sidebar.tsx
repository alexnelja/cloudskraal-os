import { NavLink } from 'react-router-dom';
import {
  SquaresFour,
  FolderOpen,
  GitDiff,
  MapTrifold,
  CalendarBlank,
  CheckSquare,
  BookOpen,
  Wrench,
  Cow,
  Factory,
  Users,
  Package,
  ChartBar,
  TreeStructure,
  Plant,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';

type NavItem = {
  to: string;
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'duotone' | 'fill'; className?: string }>;
  label: string;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { to: '/', icon: SquaresFour, label: 'Dashboard' },
      { to: '/map', icon: MapTrifold, label: 'Farm Map' },
      { to: '/calendar', icon: CalendarBlank, label: 'Calendar' },
      { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/wiki', icon: BookOpen, label: 'Wiki' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/equipment', icon: Wrench, label: 'Equipment' },
      { to: '/livestock', icon: Cow, label: 'Livestock' },
      { to: '/production', icon: Factory, label: 'Production' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/employees', icon: Users, label: 'Employees' },
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/financials', icon: ChartBar, label: 'Financials' },
      { to: '/cost-map', icon: TreeStructure, label: 'Cost Map' },
      { to: '/projects', icon: FolderOpen, label: 'CapEx' },
      { to: '/compare', icon: GitDiff, label: 'Compare' },
    ],
  },
];

/**
 * Desktop side navigation — MD3 `<md-navigation-drawer>` container with
 * react-router `NavLink` items styled per the MD3 navigation-item spec
 * (56px pill rows, secondary-container active indicator).
 *
 * We always render `opened` — `md-navigation-drawer` exposes a closing
 * animation only when used modally. The drawer is hidden below md via the
 * `.md3-side-nav` CSS block in index.css.
 */
export default function Sidebar() {
  return (
    <md-navigation-drawer class="md3-side-nav" opened pivot="start" aria-label="Primary">
      <div
        className="flex items-center gap-3 px-5 py-6"
        style={{
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
          }}
        >
          <Plant size={18} weight="fill" />
        </div>
        <div className="overflow-hidden">
          <h1
            className="leading-tight tracking-wide"
            style={{ font: 'var(--md-sys-typescale-title-medium)' }}
          >
            Cloudskraal
          </h1>
          <p
            className="leading-tight"
            style={{
              font: 'var(--md-sys-typescale-label-small)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            Boerderye
          </p>
        </div>
      </div>

      <nav className="py-2" aria-label="Primary navigation">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {group.label && <div className="md3-nav-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `md3-nav-item${isActive ? ' is-active' : ''}`
                  }
                >
                  <Icon size={24} weight="duotone" className="md3-nav-item__icon" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </md-navigation-drawer>
  );
}
