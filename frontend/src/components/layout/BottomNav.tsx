import { useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MdNavigationBar } from '@material/web/labs/navigationbar/navigation-bar';

type Tab = {
  to: string;
  label: string;
  /** Material Symbols icon name — rendered inside `<md-icon slot="active-icon">` / `slot="inactive-icon"`. */
  icon: string;
};

const tabs: Tab[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/tasks', label: 'Tasks', icon: 'task_alt' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  { to: '/wiki', label: 'Wiki', icon: 'menu_book' },
];

function indexForPath(pathname: string): number {
  // `/` is exact-match; others match by prefix so `/tasks/123` stays active on the Tasks tab.
  if (pathname === '/') return 0;
  const idx = tabs.findIndex((t) => t.to !== '/' && pathname.startsWith(t.to));
  return idx === -1 ? 0 : idx;
}

/**
 * Mobile bottom navigation — MD3 `<md-navigation-bar>`.
 *
 * The Lit element dispatches `navigation-bar-activated` with the new
 * activeIndex; we translate that into a react-router navigate(). We also push
 * the current route's index back into `activeIndex` whenever the URL changes
 * so browser back/forward stays in sync with the bar.
 */
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const barRef = useRef<MdNavigationBar | null>(null);

  const activeIndex = useMemo(() => indexForPath(location.pathname), [location.pathname]);

  // Keep the web component's activeIndex in sync with the router.
  useEffect(() => {
    if (barRef.current && barRef.current.activeIndex !== activeIndex) {
      barRef.current.activeIndex = activeIndex;
    }
  }, [activeIndex]);

  // Listen for user-driven tab activations and navigate.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ activeIndex: number }>).detail;
      const target = tabs[detail.activeIndex];
      if (target && target.to !== location.pathname) {
        navigate(target.to);
      }
    };
    el.addEventListener('navigation-bar-activated', handler);
    return () => el.removeEventListener('navigation-bar-activated', handler);
  }, [navigate, location.pathname]);

  return (
    <md-navigation-bar
      ref={barRef}
      class="md3-bottom-nav md:hidden"
      aria-label="Main navigation"
    >
      {tabs.map((tab, i) => (
        <md-navigation-tab
          key={tab.to}
          label={tab.label}
          active={i === activeIndex}
          // `label` is a Lit property (not reflected as a DOM attribute), so screen
          // readers don't pick it up on the navigation button — add aria-label to
          // guarantee the accessible name.
          aria-label={tab.label}
        >
          <md-icon slot="active-icon" aria-hidden="true">{tab.icon}</md-icon>
          <md-icon slot="inactive-icon" aria-hidden="true">{tab.icon}</md-icon>
        </md-navigation-tab>
      ))}
    </md-navigation-bar>
  );
}
