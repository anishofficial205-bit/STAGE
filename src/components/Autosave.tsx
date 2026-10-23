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

/** How long a save may stay pending before the status admits it's still saving. */
const SLOW = 1_000;

/**
 * Autosave: shortly after any change, every 30 seconds as a fallback, and when
 * the tab is closed. Nothing shows while all is well; "Saving…" only appears
 * when a save is taking longer than a second, and a failed save offers a retry.
 */
export function SaveStatus() {
  const dirty = useProjectStore((s) => s.dirty);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const save = () => {
      if (useProjectStore.getState().dirty) setFailed(!trySave());
    };
    const interval = window.setInterval(save, INTERVAL);
    // "Major changes" are the ones that create an undo step.
    let timer: number | undefined;
    let slowTimer: number | undefined;
    const unsub = useProjectStore.subscribe((s, prev) => {
      if (s.past.length !== prev.past.length || s.future.length !== prev.future.length || (s.dirty && !prev.dirty)) {
        window.clearTimeout(timer);
        timer = window.setTimeout(save, AFTER_CHANGE);
      }
      if (s.dirty && !prev.dirty) {
        window.clearTimeout(slowTimer);
        slowTimer = window.setTimeout(() => setSlow(useProjectStore.getState().dirty), AFTER_CHANGE + SLOW);
      }
      if (!s.dirty && prev.dirty) {
        window.clearTimeout(slowTimer);
        setSlow(false);
      }
    });
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    const clock = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
      window.clearTimeout(timer);
      window.clearTimeout(slowTimer);
      unsub();
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  const ago = lastSavedAt ? Math.round((Date.now() - lastSavedAt) / 1000) : null;
  const saving = dirty && slow;
  // All is well: stay out of sight (saving carries on in the background).
  if (!failed && !saving) return null;
  const label = failed ? 'Couldn’t save — retry' : saving ? 'Saving…' : ago === null || ago < 60 ? 'Saved' : `Saved ${Math.round(ago / 60)} min ago`;
  return (
    <button
      className={`save-status ${failed ? 'is-error' : saving ? 'is-pending' : ''}`}
      onClick={() => setFailed(!trySave())}
      title={failed ? 'This browser refused to save (storage may be full). Click to try again, or use Export → Download project to keep a copy.' : 'Your work is saved in this browser automatically (⌘S saves now). Use Export for a file you can keep or share.'}
    >
      <span className="save-status__dot" />
      {label}
    </button>
  );
}
