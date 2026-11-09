/* A small menu behind one button. */
import { Fragment, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

/** One item in a small menu: a button, or a link. */
export interface MenuItem {
  label: string; onClick?: () => void; to?: string; current?: boolean;
  /** A heading said once above the first item of a run with the same section (the Goals phone menu: Show, Saved views). */
  section?: string;
  /** A quieter line under the label, and a number at the end (a tab's count). */
  hint?: string; count?: number | null;
  icon?: React.ReactNode;
}

/**
 * A small menu behind one button, for actions that would otherwise crowd a row on a phone (saved views, the bulk
 * actions, Import and Export). Each item closes the menu.
 */
export function MenuButton({ label, items, className, summary, icon, display, extra }: {
  label: string; items: MenuItem[]; className?: string; summary?: string; icon?: React.ReactNode;
  /** What the button says instead of its label (the current choice); the label still names the menu. */
  display?: React.ReactNode;
  /** More, after the items (a module's tools); pressing it closes the menu as an item does. */
  extra?: React.ReactNode;
}) {
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
      <summary className={'btn sm ' + (summary ?? 'ghost')} aria-label={icon ? label : undefined} title={icon ? label : undefined}>{icon ?? display ?? label}{!icon && <Icon name="chevron-down" size={12} className="menu-chev" />}</summary>
      <div className="view-menu-list" role="group" aria-label={label}>
        {items.map((it, i) => {
          const head = it.section && it.section !== items[i - 1]?.section ? <span className="menu-section">{it.section}</span> : null;
          const body = it.hint || it.icon || it.count != null
            ? <>{it.icon}<span className="menu-text"><span>{it.label}</span>{it.hint && <span className="hint">{it.hint}</span>}</span>{it.count != null && <span className="tabcount">{it.count}</span>}</>
            : it.label;
          return (
            <Fragment key={(it.section ?? '') + it.label}>
              {head}
              {it.to
                ? <Link className="menuitem" to={it.to} onClick={close}>{body}</Link>
                : <button type="button" className="menuitem" aria-current={it.current || undefined} onClick={() => { close(); it.onClick?.(); }}>{body}</button>}
            </Fragment>
          );
        })}
        {extra && <div className="menu-extra" onClick={close}>{extra}</div>}
      </div>
    </details>
  );
}
