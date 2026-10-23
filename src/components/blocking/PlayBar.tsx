import { useBlockingUI } from '../../blocking/ui';
import { useSceneDuration } from './useSceneDuration';
import { useAutoCheck } from './ChecksPanel';
import { useActiveBlocking } from '../../store/useProjectStore';

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/** Play, pause, scrub, speed and follow for the current scene (Blocking mode). */
export function PlayBar() {
  const { duration, name } = useSceneDuration();
  const time = useBlockingUI((s) => s.time);
  const playing = useBlockingUI((s) => s.playing);
  const rate = useBlockingUI((s) => s.rate);
  const follow = useBlockingUI((s) => s.follow);
  const ui = useBlockingUI.getState();
  useAutoCheck();
  const b = useActiveBlocking();
  const tool = useBlockingUI((s) => s.tool);
  const scene = b.scenes.find((x) => x.id === b.sceneId);
  if (!b.performers.length) return null;
  const noPaths = !scene?.paths.length;
  return (
    <>
      {tool === 'path' && (
        <div className="draw-hint" role="status">
          Click to add points · Double-click to finish · Esc to cancel
        </div>
      )}
      {noPaths && tool !== 'path' && (
        <div className="path-hint" role="note">
          <svg viewBox="0 0 120 40" width="120" height="40" aria-hidden>
            <circle cx="14" cy="28" r="6" className="path-hint__who" />
            <path d="M 22 26 C 45 6, 70 40, 106 14" className="path-hint__line" />
            <path d="M 98 10 L 107 13 L 101 21" className="path-hint__arrow" />
          </svg>
          <span>
            Select a performer and click <b>Draw path</b> to plan their movement.
          </span>
        </div>
      )}
    <div className="playbar" role="group" aria-label="Scene playback" data-tour="playbar">
      <button
        className="playbar__play"
        onClick={() => {
          if (!playing && time >= duration - 0.01) ui.setTime(0);
          ui.setPlaying(!playing);
        }}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button className="playbar__btn" onClick={() => (ui.setPlaying(false), ui.setTime(0))} title="Back to the start" aria-label="Back to the start">
        ⏮
      </button>
      <span className="playbar__time">{fmt(Math.min(time, duration))}</span>
      <input className="playbar__scrub" type="range" min={0} max={duration} step={0.05} value={Math.min(time, duration)} onChange={(e) => (ui.setPlaying(false), ui.setTime(Number(e.target.value)))} aria-label="Scrub through the scene" />
      <span className="playbar__time">{fmt(duration)}</span>
      <div className="segmented" role="group" aria-label="Playback speed">
        {[0.5, 1, 2].map((r) => (
          <button key={r} className={rate === r ? 'is-active' : ''} onClick={() => ui.setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
      <button className={`btn btn--small ${follow ? 'is-active' : ''}`} onClick={ui.toggleFollow} title="Camera follows the selected performer">
        Follow
      </button>
      <span className="playbar__scene">{name}</span>
    </div>
    </>
  );
}
