import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Optional leading icon (typically a Phosphor or Lucide icon element). Wrapped in aria-hidden. */
  icon?: ReactNode;
  /** Page title rendered as the single `<h1>` of the page. */
  title: string;
  /** Optional subtitle / description line below the title. */
  subtitle?: ReactNode;
  /** Optional segmented toggle / view-switcher row shown on the right of the title. */
  segmented?: ReactNode;
  /** Trailing action buttons (typically icon-buttons or a primary create CTA). */
  actions?: ReactNode;
  /** Optional filter/search row shown below the title. Renders flush to the same surface. */
  filters?: ReactNode;
  /** Back button handler. When provided, a leading back arrow is shown. */
  onBack?: () => void;
  /**
   * Sticky positioning — sticks the header to the top of its scrolling
   * container. Uses `top: 0` by default. Pages that render inside
   * `AppShell` and have their own scrolling body should enable this.
   */
  sticky?: boolean;
}

/**
 * Unified page header — title, icon, actions, segmented toggles, filters.
 *
 * Wraps everything in a `<header>` landmark with a single `<h1>` for
 * screen-reader traversal. Typography, colour, and border come from MD3
 * tokens so it themes with the rest of the app automatically. Pages
 * should render exactly one `<PageHeader>` at the top — it replaces the
 * per-page hand-rolled headers catalogued in the cross-module audit.
 */
export default function PageHeader({
  icon,
  title,
  subtitle,
  segmented,
  actions,
  filters,
  onBack,
  sticky = false,
}: PageHeaderProps) {
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-30' : ''} flex-shrink-0`}
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
        borderBottom: '1px solid var(--md-sys-color-outline-variant)',
      }}
    >
      <div className="flex items-center gap-3 px-4 md:px-6 py-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Go back"
            className="md-shape-full p-2 -ml-2 md-duration-short3 md-ease-standard transition-colors"
            style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
          >
            {/* Inline SVG keeps this icon-library-agnostic */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {icon && (
          <span
            aria-hidden="true"
            className="flex-shrink-0"
            style={{ color: 'var(--md-sys-color-primary)' }}
          >
            {icon}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="md-title-large truncate"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              className="md-body-small truncate"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {segmented && <div className="hidden md:flex items-center">{segmented}</div>}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {filters && (
        <div
          className="px-4 md:px-6 pb-3 flex items-center gap-2 overflow-x-auto"
          style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
        >
          {filters}
        </div>
      )}

      {/* On mobile, segmented toggle drops below the title row */}
      {segmented && <div className="md:hidden px-4 pb-3">{segmented}</div>}
    </header>
  );
}
