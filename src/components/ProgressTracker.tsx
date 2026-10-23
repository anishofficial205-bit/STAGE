import { STEPS, type Mode } from '../modes';
import { useActiveBlocking, useActiveLighting, useActiveObjects, useProjectStore } from '../store/useProjectStore';

/**
 * Stage · Set · Lights · Blocking, next to the project title. A step gets a tick
 * once it has something in it; clicking a step goes there. It only informs — every
 * step is always reachable.
 */
export function ProgressTracker() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);
  const hasTemplate = useProjectStore((s) => !!s.templateId);
  const objects = useActiveObjects().length;
  const lighting = useActiveLighting();
  const performers = useActiveBlocking().performers.length;
  const done: Record<Mode, boolean> = {
    stage: hasTemplate,
    set: objects > 0,
    lights: lighting.fixtures.length > 0 || lighting.looks.length > 0,
    blocking: performers > 0,
    venue: false,
  };
  return (
    <nav className="tracker" aria-label="Progress">
      {STEPS.map((m, i) => (
        <span key={m.id} className="tracker__item">
          {i > 0 && <span className="tracker__dot" aria-hidden>·</span>}
          <button
            className={`tracker__step ${mode === m.id ? 'is-current' : ''} ${done[m.id] ? 'is-done' : ''}`}
            onClick={() => setMode(m.id)}
            aria-current={mode === m.id ? 'step' : undefined}
            title={`${m.label}${done[m.id] ? ' — has content' : ''} (${i + 1})`}
          >
            {done[m.id] && (
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="done">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
            {m.label}
          </button>
        </span>
      ))}
      {mode === 'venue' && (
        <span className="tracker__item">
          <span className="tracker__dot" aria-hidden>·</span>
          <span className="tracker__step is-current">Backstage &amp; venue</span>
        </span>
      )}
    </nav>
  );
}
