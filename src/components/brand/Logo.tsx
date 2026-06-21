// PropManage logo — a dark-green house with a sage check badge. Inline SVG so it
// stays crisp at any size and needs no asset. Used next to the wordmark.

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* chimney */}
      <rect x="31.6" y="8.5" width="4.6" height="9.4" rx="1.8" fill="#14532d" />
      {/* house silhouette with overhanging eaves */}
      <path
        d="M23 5.2 L42.8 23 H37 V38.4 a2.4 2.4 0 0 1 -2.4 2.4 H13.4 a2.4 2.4 0 0 1 -2.4 -2.4 V23 H3.2 Z"
        fill="#14532d"
      />
      {/* check badge: white halo so it reads over the house, sage ring + check */}
      <circle cx="37" cy="37" r="9.6" fill="#ffffff" />
      <circle cx="37" cy="37" r="7.9" fill="#ffffff" stroke="#8aa886" strokeWidth="2.3" />
      <path
        d="M33 37.1 l2.9 2.9 L41.3 32.9"
        stroke="#6f9a6f"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
