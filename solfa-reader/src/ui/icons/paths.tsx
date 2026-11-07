import type { ReactElement } from 'react';

/*
 * Icon artwork: 24×24 grid, 2px round strokes (set on the <svg> by Icon), ~2px padding.
 * Drawn for this project; filled shapes set fill="currentColor" explicitly.
 */

const F = 'currentColor';

export const ICON_PATHS = {
  play: <path d="M8 4.5v15L20 12z" fill={F} />,
  pause: (
    <>
      <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" fill={F} stroke="none" />
      <rect x="14" y="4" width="4.5" height="16" rx="1.2" fill={F} stroke="none" />
    </>
  ),
  stop: <rect x="5" y="5" width="14" height="14" rx="2.5" fill={F} stroke="none" />,
  'skip-back': (
    <>
      <path d="M5.5 5v14" />
      <path d="M19 5.5v13L9 12z" fill={F} />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.5-2.5h7L17 7h2.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3.5 17.5l5-5 4 4 2.5-2.5 5.5 5.5" />
    </>
  ),
  crop: (
    <>
      <path d="M6 2.5V16a2 2 0 0 0 2 2h13.5" />
      <path d="M18 21.5V8a2 2 0 0 0-2-2H2.5" />
    </>
  ),
  rotate: (
    <>
      <path d="M19.75 14a8 8 0 1 1-2.09-7.66L21 9.5" />
      <path d="M21 4.5v5h-5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="M8.7 10.7l6.6-3.9M8.7 13.3l6.6 3.9" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 17v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 17v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  forward: <path d="M5 12h14M13 6l6 6-6 6" />,
  more: (
    <>
      <circle cx="12" cy="5" r="1.7" fill={F} stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill={F} stroke="none" />
      <circle cx="12" cy="19" r="1.7" fill={F} stroke="none" />
    </>
  ),
  settings: (
    <>
      <path d="M9.8 5.78L10.21 3.18L13.79 3.18L14.2 5.78A6.6 6.6 0 0 1 14.84 6.04L16.97 4.5L19.5 7.03L17.96 9.16A6.6 6.6 0 0 1 18.22 9.8L20.82 10.21L20.82 13.79L18.22 14.2A6.6 6.6 0 0 1 17.96 14.84L19.5 16.97L16.97 19.5L14.84 17.96A6.6 6.6 0 0 1 14.2 18.22L13.79 20.82L10.21 20.82L9.8 18.22A6.6 6.6 0 0 1 9.16 17.96L7.03 19.5L4.5 16.97L6.04 14.84A6.6 6.6 0 0 1 5.78 14.2L3.18 13.79L3.18 10.21L5.78 9.8A6.6 6.6 0 0 1 6.04 9.16L4.5 7.03L7.03 4.5L9.16 6.04A6.6 6.6 0 0 1 9.8 5.78z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.25c-.65.32-1.1.95-1.1 1.7v.55" />
      <circle cx="12" cy="17" r="1.1" fill={F} stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.6-4.6" />
    </>
  ),
  undo: (
    <>
      <path d="M8.5 14L3.5 9l5-5" />
      <path d="M3.5 9H14a5.5 5.5 0 0 1 0 11h-3.5" />
    </>
  ),
  redo: (
    <>
      <path d="M15.5 14l5-5-5-5" />
      <path d="M20.5 9H10a5.5 5.5 0 0 0 0 11h3.5" />
    </>
  ),
  loop: (
    <>
      <path d="M17 2.5l3 3-3 3" />
      <path d="M4 11.5V10a4.5 4.5 0 0 1 4.5-4.5H20" />
      <path d="M7 21.5l-3-3 3-3" />
      <path d="M20 12.5V14a4.5 4.5 0 0 1-4.5 4.5H4" />
    </>
  ),
  metronome: (
    <>
      <path d="M9.2 3h5.6l4.2 18H5z" />
      <path d="M6.2 16.5h11.6" />
      <path d="M12 16.5L17.5 6" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 14.5h2.5a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M20 14.5h-2.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z" />
    </>
  ),
  volume: (
    <>
      <path d="M3.5 9.5h3.5L11.5 5.5v13l-4.5-4H3.5z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18.2 6.3a8 8 0 0 1 0 11.4" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M3.5 9.5h3.5L11.5 5.5v13l-4.5-4H3.5z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill={F} stroke="none" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" />
      <path d="M18 14.5v5M15.5 17h5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="1.1" fill={F} stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="1.1" fill={F} stroke="none" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  'chevron-left': <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  'chevron-down': <path d="M5 9l7 7 7-7" />,
  'chevron-up': <path d="M5 15l7-7 7 7" />,
  backspace: (
    <>
      <path d="M8.5 5H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8.5L2.5 12z" />
      <path d="M11 9.5l5 5M16 9.5l-5 5" />
    </>
  ),
  enter: (
    <>
      <path d="M19.5 5v6a3 3 0 0 1-3 3H5" />
      <path d="M9 10l-4 4 4 4" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9" />
    </>
  ),
  book: (
    <>
      <path d="M5 5A2 2 0 0 1 7 3h12v14H7a2 2 0 0 0-2 2z" />
      <path d="M5 19a2 2 0 0 0 2 2h12v-4" />
      <path d="M9 7.5h6" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />,
  'zoom-in': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.6-4.6M10.5 7.8v5.4M7.8 10.5h5.4" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.6-4.6M7.8 10.5h5.4" />
    </>
  ),
  scan: (
    <>
      <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <path d="M7 9.5h10M7 14.5h7" />
    </>
  ),
  text: (
    <>
      <path d="M5 7V4.5h14V7" />
      <path d="M12 4.5v15" />
      <path d="M9 19.5h6" />
    </>
  ),
  piano: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 20v-6M15 20v-6M7.5 4v10h3V4M13.5 4v10h3V4" />
    </>
  ),
} satisfies Record<string, ReactElement>;
