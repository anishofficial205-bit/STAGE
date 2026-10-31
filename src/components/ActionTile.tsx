import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Line icons for tiles (paths on a 24 × 24 grid). */
export const TILE = {
  add: 'M12 5v14M5 12h14',
  remove: 'M5 12h14',
  picture: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 16l5-5 4 4 3-3 6 6',
  floor: 'M3 15l9-5 9 5-9 5z',
  edge: 'M3 10h18v6H3z',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  wall: 'M5 4h14v16H5z',
  arch: 'M5 21V10a7 7 0 0 1 14 0v11M9 21v-10a3 3 0 0 1 6 0v10',
  face: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  bar: 'M3 8h18M7 8v3M12 8v3M17 8v3',
  audience: 'M3 7h18M5 12h14M7 17h10',
  pole: 'M12 3v18M8 7h8M8 12h8',
  curtain: 'M4 3h16M6 3c0 6 2 12 4 18M18 3c0 6-2 12-4 18M12 3v18',
  frame: 'M4 21V4h16v17M8 21V8h8v13',
  skirt: 'M3 7h18M4 7v10M9 7v10M15 7v10M20 7v10',
  platform: 'M3 10l9-4 9 4-9 4zM3 10v4l9 4 9-4v-4',
  seats: 'M5 11V6h14v5M3 11h18v5H3zM6 16v3M18 16v3',
  draw: 'M4 20h4L18 10l-4-4L4 16zM14 6l4 4',
  sets: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  photo: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  mark: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 8v4M10 10h4',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
} as const;

export const TileIcon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** The panels' action buttons: an icon over a short label, in a grid of three. */
export function Tile({ icon, label, active, className = '', ...rest }: { icon: string | ReactNode; label: ReactNode; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`action-tile ${active ? 'is-active' : ''} ${className}`} aria-pressed={active} {...rest}>
      {typeof icon === 'string' ? <TileIcon d={icon} /> : icon}
      <span>{label}</span>
    </button>
  );
}

export const Tiles = ({ children }: { children: ReactNode }) => <div className="action-tiles">{children}</div>;
