interface LoadingOverlayProps {
  /** Announced to screen readers; also shown as visible text in the `text` and `spinner` variants. */
  message?: string;
  /** `spinner` (default) | `text` | `skeleton` — skeleton expects `skeletonRows`. */
  variant?: 'spinner' | 'text' | 'skeleton';
  /** Number of skeleton bars to render in `skeleton` variant. */
  skeletonRows?: number;
  /** Dense variant — tighter padding for small containers. */
  dense?: boolean;
}

/**
 * Canonical loading surface — replaces the 10+ "Loading …" text snippets
 * catalogued in the cross-module audit. All variants wrap in
 * `role="status" aria-live="polite"` so screen readers announce the wait.
 *
 * Respects `prefers-reduced-motion` via the CSS media block in index.css:
 * the spinner animation collapses to 1ms on reduced-motion systems.
 */
export default function LoadingOverlay({
  message = 'Loading…',
  variant = 'spinner',
  skeletonRows = 3,
  dense = false,
}: LoadingOverlayProps) {
  const containerClass = `flex flex-col items-center justify-center ${
    dense ? 'py-6' : 'py-16'
  }`;

  if (variant === 'skeleton') {
    return (
      <div role="status" aria-live="polite" aria-label={message} className={`${containerClass} w-full gap-3`}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="md-shape-medium w-full max-w-xl h-14 md-duration-medium2 md-ease-standard animate-pulse"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
          />
        ))}
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div role="status" aria-live="polite" className={containerClass}>
        <p className="md-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {message}
        </p>
      </div>
    );
  }

  // spinner (default)
  return (
    <div role="status" aria-live="polite" className={containerClass}>
      <span
        aria-hidden="true"
        className="md-loader-spinner mb-3"
        style={{
          borderColor: 'var(--md-sys-color-outline-variant)',
          borderTopColor: 'var(--md-sys-color-primary)',
        }}
      />
      <p className="md-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        {message}
      </p>
    </div>
  );
}
