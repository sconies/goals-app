/* The app's own icons: 16px line drawings in the nav's style (design rule 3: no glyph characters as icons). */
export type IconName = 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'arrow-right' | 'arrow-up' | 'arrow-down' | 'trend-down' | 'minus' | 'plus' | 'back' | 'switch' | 'check-circle' | 'alert' | 'chevron-up' | 'more' | 'check' | 'settings' | 'sidebar-collapse' | 'sidebar-expand' | 'print' | 'grip' | 'download' | 'help' | 'search';

const PATHS: Record<IconName, string> = {
  search: 'M7 2.75a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5zM10.2 10.2l3.3 3.3',
  help: 'M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5zM6.15 6.3a1.9 1.9 0 1 1 2.65 1.75c-.5.22-.8.62-.8 1.15v.35M8 11.2v.2',
  grip: 'M6 4v.1M10 4v.1M6 8v.1M10 8v.1M6 12v.1M10 12v.1',
  download: 'M8 2.5v7.5M4.75 6.75 8 10l3.25-3.25M3 13.25h10',
  print: 'M4.5 6V2.5h7V6M4.5 11.5h-2V6h11v5.5h-2M4.5 9.5h7v4h-7z',
  check: 'M3.5 8.5l3 3 6-7',
  settings: 'M2.5 4.5h5.5M11.5 4.5h2M9.75 2.75v3.5M2.5 11.5h2M8 11.5h5.5M6.25 9.75v3.5',
  'sidebar-collapse': 'M2.5 3h11v10h-11zM6 3v10M10.5 6 8.5 8l2 2',
  'sidebar-expand': 'M2.5 3h11v10h-11zM6 3v10M9 6l2 2-2 2',
  close: 'M4 4l8 8M12 4l-8 8',
  'chevron-left': 'M10 3.5L5.5 8 10 12.5',
  'chevron-right': 'M6 3.5L10.5 8 6 12.5',
  'chevron-down': 'M3.5 6L8 10.5 12.5 6',
  'chevron-up': 'M3.5 10L8 5.5 12.5 10',
  more: 'M2.6 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M7.1 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M11.6 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0',
  'arrow-right': 'M3 8h10M9 4l4 4-4 4',
  'arrow-up': 'M8 13V3M4 7l4-4 4 4',
  'arrow-down': 'M8 3v10M4 9l4 4 4-4',
  'trend-down': 'M3 4.5l4 4 2.5-2.5L13 9.5M13 6v3.5H9.5',
  minus: 'M3.5 8h9',
  plus: 'M8 3.5v9M3.5 8h9',
  back: 'M6 4L2.5 7.5 6 11M3 7.5h7a3.5 3.5 0 0 1 0 7H8',
  switch: 'M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5',
  'check-circle': 'M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5zM5.4 8.2l1.8 1.8 3.4-3.8',
  alert: 'M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5zM8 4.9v3.6M8 10.9v.2',
};

/** A decorative icon (hidden from screen readers): the button or text beside it says what it does. */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={'icon' + (className ? ' ' + className : '')} viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
