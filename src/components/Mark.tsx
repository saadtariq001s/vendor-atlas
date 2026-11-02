/**
 * The eight-point star mark. Inherits colour. At small sizes it stays solid;
 * a centre `hole` (as on the sign-in panel) would read as a gear.
 */
export function Mark({ size = 24, hole }: { size?: number; hole?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="9" y="9" width="14" height="14" fill="currentColor" />
      <rect x="9" y="9" width="14" height="14" fill="currentColor" transform="rotate(45 16 16)" />
      {hole && <circle cx="16" cy="16" r="3.2" fill={hole} />}
    </svg>
  );
}
