import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FlatSections } from './Collapsible';

/**
 * Settings lists: a panel is a few groups of rows, each showing its current
 * value. A row with a page opens it in place, with a back arrow — so only one
 * topic is ever on screen.
 */
/** A page a row can open. `render` is read afresh on every render, so a page always shows current values. */
export interface PageDef {
  title: string;
  render: () => ReactNode;
}

const DrillCtx = createContext<{ push: (id: string) => void; pop: () => void } | null>(null);

const Chevron = () => (
  <svg className="sl-row__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** Holds a list and the pages its rows open (by id). Changing `resetKey` goes back to the list. */
export function Drill({ resetKey, pages, children }: { resetKey?: string; pages: Record<string, PageDef | null | false | undefined>; children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds([]), [resetKey]);
  const stack = ids.map((id) => pages[id]).filter((p): p is PageDef => !!p);
  const top = stack[stack.length - 1];
  const ctx = { push: (id: string) => setIds((s) => [...s, id]), pop: () => setIds((s) => s.slice(0, -1)) };
  return (
    <DrillCtx.Provider value={ctx}>
      {top ? (
        <div className="sl-page">
          <div className="sl-page__head">
            <button className="sl-back" onClick={ctx.pop} aria-label={`Back to ${stack.length > 1 ? stack[stack.length - 2].title : 'the list'}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className="sl-page__title">{top.title}</h2>
          </div>
          <FlatSections.Provider value={true}>
            <div className="sl-page__body">{top.render()}</div>
          </FlatSections.Provider>
        </div>
      ) : (
        <div className="sl-list">{children}</div>
      )}
    </DrillCtx.Provider>
  );
}

/** The panel's own heading, with an optional action on the right (e.g. Done). */
export function ListHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="sl-head">
      <div>
        <h2 className="sl-head__title">{title}</h2>
        {sub && <p className="sl-head__sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="sl-groupwrap">
      {title && <p className="sl-gt">{title}</p>}
      <div className="sl-group">{children}</div>
    </div>
  );
}

interface RowProps {
  label: ReactNode;
  /** The current value, shown quietly on the right. */
  value?: ReactNode;
  icon?: ReactNode;
  /** Opens this page (an id in the Drill's pages) in place. */
  page?: string;
  onClick?: () => void;
  /** Something on the right instead of the chevron (a switch, a + button). */
  action?: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  title?: string;
}

export function Row({ label, value, icon, page, onClick, action, accent, disabled, title }: RowProps) {
  const d = useContext(DrillCtx);
  const go = page ? () => d?.push(page) : onClick;
  return (
    <button className={`sl-row ${accent ? 'is-accent' : ''}`} onClick={go} disabled={disabled} title={title}>
      {icon && <span className="sl-row__icon">{icon}</span>}
      <span className="sl-row__label">{label}</span>
      {value != null && value !== '' && <span className="sl-row__value">{value}</span>}
      {action ?? (page ? <Chevron /> : null)}
    </button>
  );
}

/** A switch for the right of a row (the row itself toggles it). */
export function RowSwitch({ on }: { on: boolean }) {
  return (
    <span className={`switch ${on ? 'is-on' : ''}`} role="switch" aria-checked={on}>
      <span className="switch__knob" />
    </span>
  );
}

/** A round + for the right of a row that adds something. */
export const RowPlus = () => (
  <span className="sl-row__plus" aria-hidden>
    +
  </span>
);
