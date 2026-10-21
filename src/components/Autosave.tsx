import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

const INTERVAL = 30_000;
const AFTER_CHANGE = 1_500;

/** Save now; returns false if the browser refused (e.g. storage full). */
export function trySave(): boolean {
  try {
    useProjectStore.getState().save();
    return true;
  } catch {
    return false;
  }
}

/**
 * Autosave: every 30 seconds when there are unsaved changes, shortly after
 * every undoable change, and when the tab is closed. Shows a small status.
 */
export function SaveStatus() {
  const dirty = useProjectStore((s) => s.dirty);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const [failed, setFailed] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const save = () => {
      if (useProjectStore.getState().dirty) setFailed(!trySave());
    };
    const interval = window.setInterval(save, INTERVAL);
    // "Major changes" are the ones that create an undo step.
    let timer: number | undefined;
    const unsub = useProjectStore.subscribe((s, prev) => {
      if (s.past.length !== prev.past.length || s.future.length !== prev.future.length) {
        window.clearTimeout(timer);
        timer = window.setTimeout(save, AFTER_CHANGE);
      }
    });
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    const clock = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
      window.clearTimeout(timer);
      unsub();
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  const ago = lastSavedAt ? Math.round((Date.now() - lastSavedAt) / 1000) : null;
  const label = failed ? 'Couldn’t save — export a backup' : dirty ? 'Saving…' : ago === null ? 'All changes saved' : ago < 10 ? 'Saved' : ago < 60 ? 'Saved' : `Saved ${Math.round(ago / 60)} min ago`;
  return (
    <button
      className={`save-status ${failed ? 'is-error' : dirty ? 'is-pending' : ''}`}
      onClick={() => setFailed(!trySave())}
      title="Your work is saved in this browser automatically (⌘S saves now). Use Export for a file you can keep or share."
    >
      <span className="save-status__dot" />
      {label}
    </button>
  );
}
