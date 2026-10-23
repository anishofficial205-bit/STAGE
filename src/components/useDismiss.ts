import { useEffect, useId, type RefObject } from 'react';

const OPENED = 'stage-builder:menu-opened';

/**
 * Popovers and menus: close on Escape, on a click outside `ref`, and when any
 * other menu opens (so only one is ever open at a time).
 */
export function useDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPENED, { detail: id }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) close();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener(OPENED, onOther);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener(OPENED, onOther);
    };
  }, [open, close, ref, id]);
}

/** Tell every open menu to close (e.g. when a context menu opens). */
export const announceMenuOpened = (id = 'other') => window.dispatchEvent(new CustomEvent(OPENED, { detail: id }));
