/**
 * One-click masking: sets of legs and borders spaced from the proscenium to
 * the back wall, and a false proscenium (tormentors and teaser) for stages with no arch.
 */
import { useProjectStore } from '../../store/useProjectStore';
import { newObjectId } from '../../store/ids';
import { applyConstraints, defaultParams } from '../../helpers/params';
import { getObjectType } from '../registry';
import { currentStage } from '../actions';
import { GROUP_TYPE, type SetObject } from '../types';
import type { Params } from '../../types';
import { playingArea } from './drapes';

function piece(type: string, name: string, x: number, z: number, elevation: number, params: Params, parent: string): SetObject {
  const t = getObjectType(type)!;
  return { id: newObjectId(), type, name, params: applyConstraints(t, { ...defaultParams(t), ...params }), x, z, elevation, rotation: 0, parent };
}

/** Add pieces (plus their group entries) as one undo step and select them. */
function addAll(items: SetObject[], label: string) {
  const s = useProjectStore.getState();
  s.updateObjects((list) => [...list, ...items]);
  s.select(items.filter((o) => o.type !== GROUP_TYPE).map((o) => o.id));
  useProjectStore.setState({ lastAction: { label, nonce: Date.now() } });
}

const LEG_W = 2;

/** `count` sets of a leg each side plus a border, evenly spaced from the front line to the back wall. */
export function addMaskingSets(count: number) {
  const { info } = currentStage();
  const a = playingArea(info);
  const [cx, cz] = info.centre;
  const items: SetObject[] = [];
  for (let i = 0; i < count; i++) {
    const z = a.front + ((a.back - a.front) * (i + 0.5)) / count - cz;
    const n = i + 1;
    const group: SetObject = { id: newObjectId(), type: GROUP_TYPE, name: `Masking set ${n}`, params: {}, x: 0, z: 0, elevation: 0, rotation: 0 };
    // Legs overlap the edge of the opening a little so the wings stay hidden; stage left is +X.
    const legX = a.width / 2 + LEG_W / 2 - 0.3;
    const legH = a.height + 1.5;
    items.push(
      piece('leg', `Leg SL ${n}`, a.cx - cx + legX, z, 0, { width: LEG_W, height: legH }, group.id),
      piece('leg', `Leg SR ${n}`, a.cx - cx - legX, z, 0, { width: LEG_W, height: legH }, group.id),
      // The border hangs just upstage of its legs, its bottom a little below the top of the opening.
      piece('border', `Border ${n}`, a.cx - cx, z - 0.25, Math.max(0.5, a.height - 0.4), { width: a.width + 2 * LEG_W, height: 2.2 }, group.id),
      group,
    );
  }
  addAll(items, `Added ${count} masking set${count === 1 ? '' : 's'}`);
}

/** Tormentors (front legs) and a teaser (front border) framing a false proscenium. */
export function addFalseProscenium() {
  const { info } = currentStage();
  const a = playingArea(info);
  const [cx, cz] = info.centre;
  const z = a.front - (info.opening ? 0.5 : 0) - cz;
  const w = 1.2;
  const group: SetObject = { id: newObjectId(), type: GROUP_TYPE, name: 'False proscenium', params: {}, x: 0, z: 0, elevation: 0, rotation: 0 };
  const x = a.width / 2 + w / 2 - 0.4;
  const h = a.height + 1;
  addAll(
    [
      piece('leg', 'Tormentor SL', a.cx - cx + x, z, 0, { width: w, height: h, build: 'flat' }, group.id),
      piece('leg', 'Tormentor SR', a.cx - cx - x, z, 0, { width: w, height: h, build: 'flat' }, group.id),
      piece('border', 'Teaser', a.cx - cx, z + 0.1, Math.max(0.5, a.height - 0.6), { width: a.width + 2 * w, height: 1.6, build: 'flat' }, group.id),
      group,
    ],
    'Added tormentors and teaser',
  );
}
