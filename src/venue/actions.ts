/**
 * Venue edits (all undoable through the project store; drags merge into one step).
 */
import { useProjectStore } from '../store/useProjectStore';
import { M_PER_FT } from '../units';
import { dist, projectOnWall, samePt } from './geometry';
import { enclosedArea } from './rooms';
import { DOOR_PRESETS, ROOM_TYPES, WALL_DEFAULTS, venueId, type Door, type Furniture, type Pt, type Room, type Route, type RouteEnd, type Venue, type Wall } from './types';
import { endName } from './routes';
import { useVenueUI } from './ui';

/** Plan grid: 0.1 m, or 3 in when working in feet. */
export const planGrid = () => (useProjectStore.getState().units === 'ft' ? 0.25 * M_PER_FT : 0.1);

const venue = () => useProjectStore.getState().venue;
const update = (fn: (v: Venue) => Venue, key?: string) => useProjectStore.getState().setVenue(fn, key);

/** Move every wall end sitting at `from` (so joined walls stay joined). */
const moveEnds = (walls: Wall[], from: Pt, to: Pt) => walls.map((w) => ({ ...w, a: samePt(w.a, from) ? to : w.a, b: samePt(w.b, from) ? to : w.b }));

/** Look for new walls: like the last one drawn, else the defaults. */
const wallLook = () => {
  const last = venue().walls[venue().walls.length - 1];
  return last ? { thickness: last.thickness, height: last.height, material: last.material } : WALL_DEFAULTS;
};

/** "Dressing room", then "Dressing room 2", ... */
function roomName(type: string, rooms: Room[]) {
  const base = ROOM_TYPES[type]?.label ?? 'Room';
  const n = rooms.filter((r) => r.type === type).length;
  return n ? `${base} ${n + 1}` : base;
}

export const venueActions = {
  /** Turn the drawn corners into connected walls. */
  finishWalls: (points: Pt[]) => {
    const pts = points.filter((p, i) => i === 0 || !samePt(p, points[i - 1]));
    if (pts.length < 2) return [];
    const look = wallLook();
    const walls: Wall[] = pts.slice(1).map((b, i) => ({ id: venueId('w'), a: pts[i], b, ...look }));
    update((v) => ({ ...v, walls: [...v.walls, ...walls] }));
    return walls;
  },
  patchWall: (id: string, change: Partial<Wall>, key?: string) => update((v) => ({ ...v, walls: v.walls.map((w) => (w.id === id ? { ...w, ...change } : w)) }), key ?? `wall:${id}:${Object.keys(change).join()}`),
  /** Set a wall's length, keeping its start (and moving the walls joined at its end). */
  setLength: (id: string, length: number) => {
    const w = venue().walls.find((x) => x.id === id);
    if (!w || length < 0.05) return;
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1;
    const to: Pt = [w.a[0] + ((w.b[0] - w.a[0]) / L) * length, w.a[1] + ((w.b[1] - w.a[1]) / L) * length];
    update((v) => ({ ...v, walls: moveEnds(v.walls, w.b, to) }), `wall-len:${id}`);
  },
  /** Drag one end of a wall to `to`; walls joined there follow. */
  moveEnd: (from: Pt, to: Pt, key: string) => update((v) => ({ ...v, walls: moveEnds(v.walls, from, to) }), key),
  /** Move a whole wall by (dx, dz) from its starting position; walls joined to it stretch to follow. */
  moveWall: (start: Wall, dx: number, dz: number, key: string) =>
    update((v) => {
      const cur = v.walls.find((w) => w.id === start.id);
      if (!cur) return v;
      let walls = moveEnds(v.walls, cur.a, [start.a[0] + dx, start.a[1] + dz]);
      walls = moveEnds(walls, cur.b, [start.b[0] + dx, start.b[1] + dz]);
      return { ...v, walls };
    }, key),
  removeWall: (id: string) => {
    update((v) => {
      const gone = new Set(v.doors.filter((d) => d.wallId === id).map((d) => d.id));
      return { ...v, walls: v.walls.filter((w) => w.id !== id), doors: v.doors.filter((d) => !gone.has(d.id)), routes: v.routes.filter((r) => !uses(r, 'door', gone)) };
    });
    useVenueUI.getState().select(null);
  },

  /** A rectangular room: four walls on the rectangle's edges, and the room inside them. */
  addRoomRect: (a: Pt, b: Pt, type: string) => {
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [z0, z1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    if (x1 - x0 < 0.5 || z1 - z0 < 0.5) return null;
    const corners: Pt[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const look = wallLook();
    const walls: Wall[] = corners.map((p, i) => ({ id: venueId('w'), a: p, b: corners[(i + 1) % 4], ...look }));
    const h = look.thickness / 2;
    const room: Room = { id: venueId('r'), name: roomName(type, venue().rooms), type, seed: [(x0 + x1) / 2, (z0 + z1) / 2], polygon: [[x0 + h, z0 + h], [x1 - h, z0 + h], [x1 - h, z1 - h], [x0 + h, z1 - h]], floor: 'vinyl', wallHeight: look.height };
    update((v) => ({ ...v, walls: [...v.walls, ...walls], rooms: [...v.rooms, room] }));
    useVenueUI.getState().select({ kind: 'room', id: room.id });
    return room;
  },
  /** Make a room of the walled-in area around a point. Returns false if the walls don't enclose it. */
  addRoomAt: (seed: Pt, type: string) => {
    const v = venue();
    const polygon = enclosedArea(v.walls, seed);
    if (!polygon) return false;
    const room: Room = { id: venueId('r'), name: roomName(type, v.rooms), type, seed, polygon, floor: 'vinyl', wallHeight: wallLook().height };
    update((x) => ({ ...x, rooms: [...x.rooms, room] }));
    useVenueUI.getState().select({ kind: 'room', id: room.id });
    return true;
  },
  patchRoom: (id: string, change: Partial<Room>, key?: string) => update((v) => ({ ...v, rooms: v.rooms.map((r) => (r.id === id ? { ...r, ...change } : r)) }), key ?? `room:${id}:${Object.keys(change).join()}`),
  /** The room's wall height also raises or lowers the walls around it. */
  setRoomWallHeight: (id: string, height: number, outline: Pt[]) =>
    update((v) => {
      const onEdge = (w: Wall) => {
        const mid: Pt = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
        return outline.some((p, i) => {
          const q = outline[(i + 1) % outline.length];
          const fake: Wall = { ...w, a: p, b: q };
          return projectOnWall(fake, mid).offset < w.thickness / 2 + 0.15;
        });
      };
      return { ...v, rooms: v.rooms.map((r) => (r.id === id ? { ...r, wallHeight: height } : r)), walls: v.walls.map((w) => (onEdge(w) ? { ...w, height } : w)) };
    }, `room-height:${id}`),
  removeRoom: (id: string) => {
    update((v) => ({ ...v, rooms: v.rooms.filter((r) => r.id !== id), routes: v.routes.filter((r) => !uses(r, 'room', new Set([id]))) }));
    useVenueUI.getState().select(null);
  },

  addDoor: (wallId: string, s: number, preset: keyof typeof DOOR_PRESETS, side: 1 | -1) => {
    const p = DOOR_PRESETS[preset];
    const door: Door = { id: venueId('d'), wallId, s, width: p.width, height: p.height, kind: p.kind, hinge: 'a', side };
    update((v) => ({ ...v, doors: [...v.doors, door] }));
    useVenueUI.getState().select({ kind: 'door', id: door.id });
    return door;
  },
  patchDoor: (id: string, change: Partial<Door>, key?: string) => update((v) => ({ ...v, doors: v.doors.map((d) => (d.id === id ? { ...d, ...change } : d)) }), key ?? `door:${id}:${Object.keys(change).join()}`),
  removeDoor: (id: string) => {
    update((v) => ({ ...v, doors: v.doors.filter((d) => d.id !== id), routes: v.routes.filter((r) => !uses(r, 'door', new Set([id]))) }));
    useVenueUI.getState().select(null);
  },

  addFurniture: (type: string, at: Pt, rotation = 0) => {
    const f: Furniture = { id: venueId('f'), type, x: at[0], z: at[1], rotation };
    update((v) => ({ ...v, furniture: [...v.furniture, f] }));
    useVenueUI.getState().select({ kind: 'furniture', id: f.id });
    return f;
  },
  patchFurniture: (id: string, change: Partial<Furniture>, key?: string) => update((v) => ({ ...v, furniture: v.furniture.map((f) => (f.id === id ? { ...f, ...change } : f)) }), key ?? `furn:${id}:${Object.keys(change).join()}`),
  removeFurniture: (id: string) => {
    update((v) => ({ ...v, furniture: v.furniture.filter((f) => f.id !== id) }));
    useVenueUI.getState().select(null);
  },

  /** Save a route between two rooms or doors, named after its ends. */
  addRoute: (from: RouteEnd, to: RouteEnd) => {
    const v = venue();
    const route: Route = { id: venueId('p'), name: `${endName(v, from)} → ${endName(v, to)}`, from, to, visible: true };
    update((x) => ({ ...x, routes: [...x.routes, route] }));
    useVenueUI.getState().select({ kind: 'route', id: route.id });
    return route;
  },
  patchRoute: (id: string, change: Partial<Route>, key?: string) => update((v) => ({ ...v, routes: v.routes.map((r) => (r.id === id ? { ...r, ...change } : r)) }), key ?? `route:${id}:${Object.keys(change).join()}`),
  removeRoute: (id: string) => {
    update((v) => ({ ...v, routes: v.routes.filter((r) => r.id !== id) }));
    useVenueUI.getState().select(null);
  },

  /** Delete whatever is selected. */
  removeSelected: () => {
    const sel = useVenueUI.getState().selected;
    if (!sel) return;
    if (sel.kind === 'wall') venueActions.removeWall(sel.id);
    else if (sel.kind === 'room') venueActions.removeRoom(sel.id);
    else if (sel.kind === 'door') venueActions.removeDoor(sel.id);
    else if (sel.kind === 'furniture') venueActions.removeFurniture(sel.id);
    else if (sel.kind === 'route') venueActions.removeRoute(sel.id);
  },
};

/** Does this route start or end at one of these rooms/doors? */
const uses = (r: Route, kind: RouteEnd['kind'], ids: Set<string>) => (r.from.kind === kind && ids.has(r.from.id)) || (r.to.kind === kind && ids.has(r.to.id));

export { dist };
