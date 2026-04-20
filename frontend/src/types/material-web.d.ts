/**
 * JSX type declarations for `@material/web` Lit custom elements.
 *
 * React 19 natively supports custom elements, but TypeScript needs ambient
 * declarations to accept them in JSX. React 19's `@types/react` scopes the
 * JSX namespace under `React.JSX`, so we augment that via module augmentation
 * (global `JSX` no longer works with the new-jsx-transform types).
 */

import type { DetailedHTMLProps, HTMLAttributes, Ref } from 'react';
import type { MdNavigationBar } from '@material/web/labs/navigationbar/navigation-bar';
import type { MdNavigationTab } from '@material/web/labs/navigationtab/navigation-tab';
import type { MdNavigationDrawer } from '@material/web/labs/navigationdrawer/navigation-drawer';
import type { MdIcon } from '@material/web/icon/icon';
import type { MdRipple } from '@material/web/ripple/ripple';
import type { MdFocusRing } from '@material/web/focus/md-focus-ring';

// Generic wrapper for Lit custom elements — allows refs to the backing
// HTMLElement and permits any kebab-case attribute string.
type WebComponentProps<T extends HTMLElement> = Omit<
  DetailedHTMLProps<HTMLAttributes<T>, T>,
  'ref'
> & {
  ref?: Ref<T>;
  class?: string;
  [key: `data-${string}`]: string | undefined;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-navigation-bar': WebComponentProps<MdNavigationBar> & {
        'active-index'?: number;
        'hide-inactive-labels'?: boolean;
      };
      'md-navigation-tab': WebComponentProps<MdNavigationTab> & {
        label?: string;
        active?: boolean;
        disabled?: boolean;
        'hide-inactive-label'?: boolean;
        'badge-value'?: string;
        'show-badge'?: boolean;
      };
      'md-navigation-drawer': WebComponentProps<MdNavigationDrawer> & {
        opened?: boolean;
        pivot?: 'start' | 'end';
      };
      'md-icon': WebComponentProps<MdIcon> & { slot?: string };
      'md-ripple': WebComponentProps<MdRipple>;
      'md-focus-ring': WebComponentProps<MdFocusRing>;
    }
  }
}

export {};
