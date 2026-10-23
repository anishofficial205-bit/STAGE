import { useProjectStore } from '../store/useProjectStore';
import type { Mode } from '../modes';
import { ModeIcon } from './ModeBar';

const NEXT: Record<Mode, { to: Mode | 'export'; ask: string; go: string }> = {
  stage: { to: 'set', ask: 'Stage ready?', go: 'Dress the set' },
  set: { to: 'lights', ask: 'Set looking good?', go: 'Light it next' },
  lights: { to: 'blocking', ask: 'Happy with the light?', go: 'Block the actors' },
  blocking: { to: 'export', ask: 'Done?', go: 'Export your plans' },
  venue: { to: 'stage', ask: 'Building done?', go: 'Back to the stage' },
};

/** Ask the top bar to open its Export menu. */
export const OPEN_EXPORT_EVENT = 'stage-builder:open-export';

/** A small card in the corner that points to the next mode, so the order of work is always clear. */
export function NextStep() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);
  const next = NEXT[mode];
  const to = next.to;
  return (
    <button
      className="next-step"
      onClick={(e) => {
        if (to !== 'export') return setMode(to);
        e.stopPropagation();
        window.dispatchEvent(new Event(OPEN_EXPORT_EVENT));
      }}
      title={to === 'export' ? 'Images, the lighting plan, blocking sheets and the project file' : `Go to ${to} mode`}
    >
      <span className="next-step__icon">
        {to === 'export' ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
        ) : (
          <ModeIcon mode={to} size={20} />
        )}
      </span>
      <span className="next-step__text">
        {next.ask}
        <b>{next.go} →</b>
      </span>
    </button>
  );
}
