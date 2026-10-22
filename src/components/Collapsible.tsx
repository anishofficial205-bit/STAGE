import { useState, type ReactNode } from 'react';

/** A panel section with a clickable header; remembers whether it was open. */
export function Collapsible({ id, title, children, defaultOpen = true, extra, tour }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean; extra?: ReactNode; tour?: string }) {
  const key = `stage-builder:open:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(key, open ? '0' : '1');
    } catch {
      // ignore
    }
  };
  return (
    <section className={`collapsible ${open ? 'is-open' : ''}`} data-tour={tour}>
      <div className="collapsible__head">
        <button className="collapsible__toggle" onClick={toggle} aria-expanded={open}>
          <span className="collapsible__chevron">▸</span>
          {title}
        </button>
        {extra}
      </div>
      {open && <div className="collapsible__body">{children}</div>}
    </section>
  );
}
