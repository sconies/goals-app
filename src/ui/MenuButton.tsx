/* A small menu behind one button. */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

/** One item in a small menu: a button, or a link. */
export interface MenuItem { label: string; onClick?: () => void; to?: string; current?: boolean }

/**
 * A small menu behind one button, for actions that would otherwise crowd a row on a phone (saved views, the bulk
 * actions, Import and Export). Each item closes the menu.
 */
export function MenuButton({ label, items, className, summary, icon }: { label: string; items: MenuItem[]; className?: string; summary?: string; icon?: React.ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  // A press anywhere else closes it, as a menu should.
  useEffect(() => {
    const away = (e: PointerEvent) => { if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false; };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);
  return (
    <details className={'view-menu' + (className ? ' ' + className : '')} ref={menu}>
      <summary className={'btn sm ' + (summary ?? 'ghost')} aria-label={icon ? label : undefined} title={icon ? label : undefined}>{icon ?? label}{!icon && <Icon name="chevron-down" size={12} className="menu-chev" />}</summary>
      <div className="view-menu-list" role="group" aria-label={label}>
        {items.map((it) => it.to
          ? <Link key={it.label} className="menuitem" to={it.to} onClick={close}>{it.label}</Link>
          : <button key={it.label} type="button" className="menuitem" aria-current={it.current || undefined} onClick={() => { close(); it.onClick?.(); }}>{it.label}</button>)}
      </div>
    </details>
  );
}
