import { useBlockingUI } from '../../blocking/ui';
import { useSceneDuration } from './useSceneDuration';

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/** Play, pause, scrub, speed and follow for the current scene (Blocking mode). */
export function PlayBar() {
  const { duration, name } = useSceneDuration();
  const time = useBlockingUI((s) => s.time);
  const playing = useBlockingUI((s) => s.playing);
  const rate = useBlockingUI((s) => s.rate);
  const follow = useBlockingUI((s) => s.follow);
  const ui = useBlockingUI.getState();
  return (
    <div className="playbar" role="group" aria-label="Scene playback">
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
  );
}
