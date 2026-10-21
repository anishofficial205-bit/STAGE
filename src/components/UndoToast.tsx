import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

/** "Applied City theatre · Undo" — shown after presets, resets and template switches. */
export function UndoToast() {
  const undoable = useProjectStore((s) => s.undoable);
  const undo = useProjectStore((s) => s.undo);
  const dismiss = useProjectStore((s) => s.dismissUndo);
  useEffect(() => {
    if (!undoable) return;
    const t = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(t);
  }, [undoable, dismiss]);
  if (!undoable) return null;
  return (
    <div className="undo-toast" role="status">
      <span>{undoable.label}</span>
      <button className="undo-toast__btn" onClick={undo}>
        Undo
      </button>
      <button className="undo-toast__close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
