import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { topView } from '../helpers/views';
import type { PresetView, Vec3 } from '../types';

type Face = 'front' | 'top' | 'left' | 'right';

/** A camera looking at the whole stage from one side (audience side is front, +z). */
function faceView(face: Face): PresetView | null {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId);
  if (!t) return null;
  const b = t.bounds(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]);
  if (face === 'top') return topView(b, s.viewportAspect);
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const size = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2], (b.max[1] - b.min[1]) * 1.6);
  const d = size * 1.05;
  const y = c[1] + size * 0.22;
  const position: Vec3 = face === 'front' ? [c[0], y, c[2] + d] : face === 'left' ? [c[0] - d, y, c[2]] : [c[0] + d, y, c[2]];
  return { id: `cube-${face}`, label: face, position, target: [c[0], Math.max(0, c[1] * 0.6), c[2]] };
}

/** A small clickable cube in the corner: Front, Top, Left and Right views. */
export function ViewCube() {
  const requestView = useProjectStore((s) => s.requestView);
  const go = (f: Face) => {
    const v = faceView(f);
    if (v) requestView(v);
  };
  return (
    <div className="view-cube" role="group" aria-label="View cube">
      <svg viewBox="0 0 100 100" aria-hidden={false}>
        <g className="view-cube__face" onClick={() => go('top')} role="button" aria-label="Top view">
          <title>Top view</title>
          <polygon points="50,10 86,28 50,46 14,28" />
          <text x="50" y="31">Top</text>
        </g>
        <g className="view-cube__face" onClick={() => go('front')} role="button" aria-label="Front view">
          <title>Front view (from the audience)</title>
          <polygon points="14,28 50,46 50,88 14,70" />
          <text x="32" y="62">Front</text>
        </g>
        <g className="view-cube__face" onClick={() => go('right')} role="button" aria-label="Right view">
          <title>Right side view</title>
          <polygon points="50,46 86,28 86,70 50,88" />
          <text x="68" y="62">Right</text>
        </g>
      </svg>
      <button className="view-cube__left" onClick={() => go('left')} title="Left side view" aria-label="Left view">
        ◂ Left
      </button>
    </div>
  );
}
