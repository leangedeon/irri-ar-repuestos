import type { ReactNode } from 'react';

const S = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const Chev = () => (
  <S>
    <path d="M9 6l6 6-6 6" />
  </S>
);
export const Back = () => (
  <S>
    <path d="M15 6l-6 6 6 6" />
  </S>
);
export const Plus = () => (
  <S>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const Minus = () => (
  <S>
    <path d="M5 12h14" />
  </S>
);
export const Search = () => (
  <S>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </S>
);
export const Trash = () => (
  <S>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </S>
);
export const Cart = () => (
  <S>
    <path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.4" />
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </S>
);
export const Layers = () => (
  <S>
    <path d="M12 4l8 4-8 4-8-4z" />
    <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
  </S>
);
export const Split = () => (
  <S>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
  </S>
);
export const Rows = () => (
  <S>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </S>
);
export const Grid = () => (
  <S>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </S>
);
export const Info = () => (
  <S>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.5" />
  </S>
);
export const Copy = () => (
  <S>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </S>
);
export const Mail = () => (
  <S>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </S>
);
export const Whatsapp = () => (
  <S>
    <path d="M4 20l1.3-4A8 8 0 1 1 8.4 19z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.8-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-1.8z" fill="currentColor" stroke="none" />
  </S>
);
export const Menu = () => (
  <S>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </S>
);
