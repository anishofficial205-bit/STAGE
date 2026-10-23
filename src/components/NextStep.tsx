import { useProjectStore } from '../store/useProjectStore';
import type { Mode } from '../modes';
import { ModeIcon } from './ModeBar';

const NEXT: Partial<Record<Mode, { to: Mode; ask: string; go: string }>> = {
  venue: { to: 'stage', ask: 'Building done?', go: 'Shape the stage' },
  stage: { to: 'set', ask: 'Stage ready?', go: 'Dress the set' },
  set: { to: 'lights', ask: 'Set looking good?', go: 'Light it next' },
  lights: { to: 'blocking', ask: 'Happy with the light?', go: 'Block the actors' },
};

/** A small card in the corner that points to the next mode, so the order of work is always clear. */
export function NextStep() {
  const mode = useProjectStore((s) => s.mode);
  const setMode = useProjectStore((s) => s.setMode);
  const next = NEXT[mode];
  if (!next) return null;
  return (
    <button className="next-step" onClick={() => setMode(next.to)} title={`Go to ${next.to} mode`}>
      <span className="next-step__icon">
        <ModeIcon mode={next.to} size={20} />
      </span>
      <span className="next-step__text">
        {next.ask}
        <b>{next.go} →</b>
      </span>
    </button>
  );
}
