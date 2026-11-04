/* The app's own icons: 16px line drawings in the nav's style (design rule 3: no glyph characters as icons). */
export type IconName = 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'chevron-up' | 'more' | 'arrow-right' | 'trend-down' | 'minus' | 'plus' | 'back' | 'switch';

const PATHS: Record<IconName, string> = {
  close: 'M4 4l8 8M12 4l-8 8',
  'chevron-left': 'M10 3.5L5.5 8 10 12.5',
  'chevron-right': 'M6 3.5L10.5 8 6 12.5',
  'chevron-down': 'M3.5 6L8 10.5 12.5 6',
  'chevron-up': 'M3.5 10L8 5.5 12.5 10',
  more: 'M2.6 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M7.1 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0M11.6 8a.9.9 0 1 0 1.8 0a.9.9 0 1 0-1.8 0',
  'arrow-right': 'M3 8h10M9 4l4 4-4 4',
  'trend-down': 'M3 4.5l4 4 2.5-2.5L13 9.5M13 6v3.5H9.5',
  minus: 'M3.5 8h9',
  plus: 'M8 3.5v9M3.5 8h9',
  back: 'M6 4L2.5 7.5 6 11M3 7.5h7a3.5 3.5 0 0 1 0 7H8',
  switch: 'M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5',
};

/** A decorative icon (hidden from screen readers): the button or text beside it says what it does. */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={'icon' + (className ? ' ' + className : '')} viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
