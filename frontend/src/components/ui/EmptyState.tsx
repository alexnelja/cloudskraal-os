import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Optional decorative icon (wrapped in aria-hidden). */
  icon?: ReactNode;
  /** Short headline — what is empty (e.g. "No tasks yet"). */
  title: string;
  /** Optional helper text explaining why / what to do next. */
  subtitle?: ReactNode;
  /** Optional primary action (typically a CTA button). */
  action?: ReactNode;
  /**
   * Controls whether the empty state is announced to assistive tech.
   * `polite` (default) fires when it appears; `off` suppresses. Use
   * `off` for filter-driven empties that update on every keystroke.
   */
  ariaLive?: 'off' | 'polite';
  /** Dense variant — tighter padding for small containers / nested lists. */
  dense?: boolean;
}

/**
 * Canonical empty-state surface — replaces the ad-hoc "No X found." strings
 * catalogued in the cross-module audit. Always announces via `role="status"`
 * so screen-reader users know the result set is empty.
 */
export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  ariaLive = 'polite',
  dense = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live={ariaLive}
      className={`flex flex-col items-center justify-center text-center ${
        dense ? 'py-8 px-4' : 'py-16 px-6'
      }`}
      style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="mb-3 inline-flex items-center justify-center"
          style={{ color: 'var(--md-sys-color-outline)' }}
        >
          {icon}
        </span>
      )}
      <p className="md-title-medium mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        {title}
      </p>
      {subtitle && <p className="md-body-small max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
