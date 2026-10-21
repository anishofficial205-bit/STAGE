/**
 * Edits to the Black Box blocks, shared by the 3D scene (dragging, keys) and
 * the panel (buttons). Every edit re-snaps and keeps blocks inside the room.
 */
import { useProjectStore } from '../../store/useProjectStore';
import { str } from '../../helpers/params';
import { M_PER_FT } from '../../units';
import {
  findFreeSpot,
  makeLayout,
  newId,
  roomOf,
  snapAndClamp,
  useBlackBoxUI,
  type BlackBoxData,
  type Block,
  type PlatformBlock,
  type Room,
  type SeatingBlock,
} from './blocks';

/** Snap grid: 0.5 m, or 2 ft when working in feet. */
export const gridSize = () => (useProjectStore.getState().units === 'ft' ? 2 * M_PER_FT : 0.5);

/** `key` merges rapid edits of the same kind (e.g. one drag) into a single undo step. */
function update(fn: (blocks: Block[], room: Room, grid: number) => Block[], key?: string) {
  const s = useProjectStore.getState();
  const room = roomOf(s.paramsByTemplate[s.templateId]);
  s.setData((d) => ({ blocks: fn((d as BlackBoxData).blocks, room, gridSize()) }), key);
}

/** Apply a change to one block, then re-snap it against the others. */
function edit(id: string, change: (b: Block) => Block, key?: string) {
  update((blocks, room, grid) => {
    const others = blocks.filter((b) => b.id !== id);
    return blocks.map((b) => (b.id === id ? snapAndClamp(change(b), others, room, grid) : b));
  }, key);
}

const select = (id: string | null) => useBlackBoxUI.getState().select(id);

export const blockActions = {
  move: (id: string, x: number, z: number) => edit(id, (b) => ({ ...b, x, z }), `block-move:${id}`),
  patch: (id: string, changes: Partial<PlatformBlock> | Partial<SeatingBlock>) =>
    edit(id, (b) => ({ ...b, ...changes }) as Block, `block-patch:${id}:${Object.keys(changes).join()}`),
  rotate: (id: string, degrees: number) => edit(id, (b) => ({ ...b, rotation: (((b.rotation + degrees) % 360) + 360) % 360 })),
  remove: (id: string) => {
    update((blocks) => blocks.filter((b) => b.id !== id));
    select(null);
  },
  duplicate: (id: string) => {
    const copyId = newId();
    update((blocks, room, grid) => {
      const src = blocks.find((b) => b.id === id);
      if (!src) return blocks;
      return [...blocks, findFreeSpot({ ...src, id: copyId, x: src.x + grid * 2, z: src.z + grid * 2 }, blocks, room, grid)];
    });
    select(copyId);
  },
  add: (kind: 'platform' | 'seating') => {
    const id = newId();
    update((blocks, room, grid) => {
      const fresh: Block =
        kind === 'platform'
          ? { id, kind, x: 0, z: 0, rotation: 0, width: 1.2, depth: 2.4, height: 0.4 }
          : { id, kind, x: 0, z: 0, rotation: 0, rows: 4, seatsPerRow: 8, rake: 0.25 };
      return [...blocks, findFreeSpot(fresh, blocks, room, grid)];
    });
    select(id);
  },
  /** Throw away edits and re-place blocks for the chosen starting layout. */
  resetLayout: () => {
    const s = useProjectStore.getState();
    const p = s.paramsByTemplate[s.templateId];
    s.setData(() => ({ blocks: makeLayout(str(p, 'layout'), roomOf(p)) }));
    select(null);
  },
};
