/**
 * The 2D floor plan (Venue mode): a top-down drawing of the venue in metres
 * (x right, z down — the audience is towards the bottom). Pan by dragging the
 * background (or with the middle button), zoom with the wheel. The stage and
 * seating show as a grey footprint that can't be edited here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTemplate } from '../../templates/registry';
import { useActiveData, useActiveParams, useProjectStore } from '../../store/useProjectStore';
import { formatLength } from '../../units';
import { dist, doorSpan, projectOnWall, snapWallPoint, wallFrame, wallLength, wallPieces, type SnapResult } from '../../venue/geometry';
import { ROOM_TYPES, WALL_MATERIALS, type Door, type Furniture, type Pt, type Wall } from '../../venue/types';
import { planGrid, venueActions } from '../../venue/actions';
import { useVenueUI } from '../../venue/ui';
import { centroid, polygonArea, roomOutline } from '../../venue/rooms';
import { getFurniture } from '../../venue/furniture';
import { formatArea } from './format';
import { endPoint, formatTime, solveRoute, WALK } from '../../venue/routes';
import { calibrateTrace, patchTrace, useTraceUrl } from '../../venue/trace';
import { roomAt } from '../../venue/rooms';
import { Modal } from '../Modal';
import { fromDisplay, toDisplay } from '../../units';
import type { RouteEnd, Trace } from '../../venue/types';

interface View {
  cx: number;
  cz: number;
  /** Pixels per metre. */
  scale: number;
}

const SNAP_PX = 12;
const ACCENT = '#2f6fde';

type Drag =
  | { kind: 'pan'; start: [number, number]; view: View; moved: boolean }
  | { kind: 'wall'; start: Pt; wall: Wall; moved: boolean; key: string }
  | { kind: 'end'; from: Pt; moved: boolean; key: string }
  | { kind: 'click'; start: [number, number]; moved: boolean }
  | { kind: 'rect'; start: Pt; startPx: [number, number]; moved: boolean }
  | { kind: 'door'; door: Door; wall: Wall; moved: boolean; key: string }
  | { kind: 'furniture'; start: Pt; item: Furniture; moved: boolean; key: string }
  | { kind: 'trace'; start: Pt; trace: Trace; moved: boolean; key: string };

/** The current stage's floors and seats, for the grey footprint. */
function useFootprint() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  return useMemo(() => {
    const t = getTemplate(templateId)!;
    // Raised floors only: a flat room floor (Black Box, Build Your Own) isn't the stage.
    const floors = t.stage?.(params, data).floors.filter((f) => f.height > 0.01).map((f) => f.outline) ?? [];
    const seats = t.seats?.(params, data) ?? [];
    let path = '';
    for (const s of seats) path += `M${(s.x - 0.22).toFixed(2)} ${(s.z - 0.22).toFixed(2)}h0.44v0.44h-0.44z`;
    const b = t.bounds(params, data);
    return { floors, seats: path, bounds: b };
  }, [templateId, params, data]);
}

function Label({ at, text, scale, accent }: { at: Pt; text: string; scale: number; accent?: boolean }) {
  const fs = 11 / scale;
  return (
    <text x={at[0]} y={at[1]} fontSize={fs} textAnchor="middle" dominantBaseline="central" className={`plan-label ${accent ? 'is-accent' : ''}`} style={{ strokeWidth: 3 / scale }}>
      {text}
    </text>
  );
}

function Grid({ view, w, h }: { view: View; w: number; h: number }) {
  const x0 = view.cx - w / 2 / view.scale;
  const x1 = view.cx + w / 2 / view.scale;
  const z0 = view.cz - h / 2 / view.scale;
  const z1 = view.cz + h / 2 / view.scale;
  // 1 m lines when zoomed in, 5 m always.
  const minor = view.scale > 12 ? 1 : 5;
  const lines: JSX.Element[] = [];
  for (let x = Math.floor(x0 / minor) * minor; x <= x1; x += minor) lines.push(<line key={`x${x}`} x1={x} y1={z0} x2={x} y2={z1} className={x % 5 === 0 ? 'plan-grid is-major' : 'plan-grid'} />);
  for (let z = Math.floor(z0 / minor) * minor; z <= z1; z += minor) lines.push(<line key={`z${z}`} x1={x0} y1={z} x2={x1} y2={z} className={z % 5 === 0 ? 'plan-grid is-major' : 'plan-grid'} />);
  return <g>{lines}</g>;
}

/** A filled arrowhead at the end of a path, `size` long. */
function arrowHead(path: Pt[], size: number): Pt[] {
  const b = path[path.length - 1];
  const a = path[path.length - 2] ?? b;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const n: Pt = [-d[1], d[0]];
  const base: Pt = [b[0] - d[0] * size, b[1] - d[1] * size];
  return [b, [base[0] + n[0] * size * 0.5, base[1] + n[1] * size * 0.5], [base[0] - n[0] * size * 0.5, base[1] - n[1] * size * 0.5]];
}

/** Nearest wall to a point within `r` (beyond its half thickness), with where along it. */
function wallNear(walls: Wall[], p: Pt, r: number) {
  let best: { wall: Wall; s: number; side: 1 | -1 } | null = null;
  let bd = Infinity;
  for (const w of walls) {
    const q = projectOnWall(w, p);
    const d = q.offset - w.thickness / 2;
    if (d < r && d < bd) {
      bd = d;
      const f = wallFrame(w, q.s);
      const side = (p[0] - q.at[0]) * f.n[0] + (p[1] - q.at[1]) * f.n[1] >= 0 ? 1 : -1;
      best = { wall: w, s: q.s, side };
    }
  }
  return best;
}

/** Furniture dropped near a wall turns its back to the wall and sits against it. */
function placeFurniture(walls: Wall[], type: string, p: Pt): { at: Pt; rotation: number } {
  const f = getFurniture(type);
  const near = f && wallNear(walls, p, 0.8);
  if (!f || !near) return { at: p, rotation: 0 };
  const fr = wallFrame(near.wall, near.s);
  const out: Pt = [fr.n[0] * near.side, fr.n[1] * near.side];
  const off = near.wall.thickness / 2 + f.d / 2 + 0.02;
  const rotation = Math.round((Math.atan2(out[0], out[1]) * 180) / Math.PI);
  return { at: [fr.at[0] + out[0] * off, fr.at[1] + out[1] * off], rotation };
}

/** Plan symbol for a door: leaf (or leaves) drawn open with the swing arc; an opening is dashed. */
function DoorSymbol({ wall, door, scale, selected }: { wall: Wall; door: Door; scale: number; selected: boolean }) {
  const [s0, s1] = doorSpan(wall, door);
  const sw = 1.5 / scale;
  const cls = `plan-door ${selected ? 'is-selected' : ''}`;
  const leaf = (hingeU: number, len: number, dir: 1 | -1, key: string) => {
    const f = wallFrame(wall, hingeU);
    const tip: Pt = [f.at[0] + f.n[0] * door.side * len, f.at[1] + f.n[1] * door.side * len];
    const closed: Pt = [f.at[0] + f.d[0] * dir * len, f.at[1] + f.d[1] * dir * len];
    // Sweep flag: which way round the quarter circle goes, from the open tip to the closed position.
    const cross = (tip[0] - f.at[0]) * (closed[1] - f.at[1]) - (tip[1] - f.at[1]) * (closed[0] - f.at[0]);
    return (
      <g key={key}>
        <line x1={f.at[0]} y1={f.at[1]} x2={tip[0]} y2={tip[1]} style={{ strokeWidth: sw * 1.6 }} />
        <path d={`M${tip[0]} ${tip[1]} A${len} ${len} 0 0 ${cross > 0 ? 1 : 0} ${closed[0]} ${closed[1]}`} className="plan-door__arc" style={{ strokeWidth: sw }} />
      </g>
    );
  };
  const a = wallFrame(wall, s0).at;
  const b = wallFrame(wall, s1).at;
  const mid = wallFrame(wall, (s0 + s1) / 2);
  return (
    <g className={cls} data-door={door.id}>
      {/* Wide invisible hit area so the door is easy to click. */}
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="plan-door__hit" style={{ strokeWidth: Math.max(wall.thickness, 12 / scale) }} />
      {door.kind === 'opening' ? (
        <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeDasharray={`${4 / scale} ${3 / scale}`} style={{ strokeWidth: sw }} />
      ) : door.kind === 'double' ? (
        <>
          {leaf(s0, (s1 - s0) / 2, 1, 'l')}
          {leaf(s1, (s1 - s0) / 2, -1, 'r')}
        </>
      ) : door.hinge === 'a' ? (
        leaf(s0, s1 - s0, 1, 'l')
      ) : (
        leaf(s1, s1 - s0, -1, 'r')
      )}
      {door.entrance && (
        <text x={mid.at[0] - mid.n[0] * door.side * 0.6} y={mid.at[1] - mid.n[1] * door.side * 0.6} fontSize={11 / scale} textAnchor="middle" dominantBaseline="central" className="plan-label plan-entrance" style={{ strokeWidth: 3 / scale }}>
          ★ {door.entrance}
        </text>
      )}
    </g>
  );
}

function FurnitureSymbol({ item, scale, selected, ghost }: { item: Furniture; scale: number; selected?: boolean; ghost?: boolean }) {
  const f = getFurniture(item.type);
  if (!f) return null;
  // Plan is x right / z down; the piece's rotation is about +y (anticlockwise seen from above = clockwise on the plan).
  return (
    <g transform={`translate(${item.x} ${item.z}) rotate(${-item.rotation})`} data-furniture={ghost ? undefined : item.id} className={`plan-furniture ${selected ? 'is-selected' : ''} ${ghost ? 'is-ghost' : ''}`}>
      <rect x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} style={{ strokeWidth: 1.2 / scale }} />
      <line x1={-f.w / 2} y1={f.d / 2} x2={f.w / 2} y2={f.d / 2} className="plan-furniture__front" style={{ strokeWidth: 2.2 / scale }} />
    </g>
  );
}

export function PlanView() {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const units = useProjectStore((s) => s.units);
  const venue = useProjectStore((s) => s.venue);
  const { walls, rooms, doors, furniture } = venue;
  const tool = useVenueUI((s) => s.tool);
  const draft = useVenueUI((s) => s.draft);
  const hover = useVenueUI((s) => s.hover);
  const selected = useVenueUI((s) => s.selected);
  const notice = useVenueUI((s) => s.notice);
  const furnitureType = useVenueUI((s) => s.furnitureType);
  const footprint = useFootprint();
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<Drag | null>(null);
  const clickPending = useRef(false);
  const [cursor, setCursor] = useState('default');
  const [pointer, setPointer] = useState<Pt | null>(null);
  const [rectEnd, setRectEnd] = useState<Pt | null>(null);
  const routeStart = useVenueUI((s) => s.routeStart);
  const calPoints = useVenueUI((s) => s.calPoints);
  const traceUrl = useTraceUrl(venue.trace?.id);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Frame the stage and everything drawn. */
  const fit = useCallback(() => {
    const { min, max } = footprint.bounds;
    const t = venue.trace && !venue.trace.hidden ? venue.trace : null;
    const tx = t ? [t.x, t.x + t.width * t.mPerPx] : [];
    const tz = t ? [t.z, t.z + t.height * t.mPerPx] : [];
    const xs = [min[0], max[0], ...tx, ...walls.flatMap((w) => [w.a[0], w.b[0]])];
    const zs = [min[2], max[2], ...tz, ...walls.flatMap((w) => [w.a[1], w.b[1]])];
    const [x0, x1, z0, z1] = [Math.min(...xs) - 3, Math.max(...xs) + 3, Math.min(...zs) - 3, Math.max(...zs) + 3];
    setView({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: Math.max(2, Math.min(size.w / (x1 - x0), size.h / (z1 - z0))) });
  }, [footprint.bounds, walls, size, venue.trace]);
  useEffect(() => {
    if (!view && size.w > 10) fit();
  }, [view, size, fit]);

  const v = view ?? { cx: 0, cz: 0, scale: 20 };
  const toWorld = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = svg.current!.getBoundingClientRect();
      return [(clientX - r.left - r.width / 2) / v.scale + v.cx, (clientY - r.top - r.height / 2) / v.scale + v.cz];
    },
    [v],
  );

  // Wheel zoom about the cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((cur) => {
        if (!cur) return cur;
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left - r.width / 2;
        const pz = e.clientY - r.top - r.height / 2;
        const scale = Math.max(1.5, Math.min(400, cur.scale * Math.exp(-e.deltaY * 0.0015)));
        const wx = px / cur.scale + cur.cx;
        const wz = pz / cur.scale + cur.cz;
        return { scale, cx: wx - px / scale, cz: wz - pz / scale };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const snapAt = useCallback(
    (clientX: number, clientY: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }, o: { exclude?: (w: Wall) => boolean; noAngle?: boolean } = {}): SnapResult => {
      const d = useVenueUI.getState().draft;
      return snapWallPoint(toWorld(clientX, clientY), o.noAngle ? undefined : d[d.length - 1], {
        walls: o.exclude ? walls.filter((w) => !o.exclude!(w)) : walls,
        outlines: footprint.floors,
        radius: SNAP_PX / v.scale,
        grid: planGrid(),
        freeAngle: e.shiftKey,
        noSnap: e.metaKey || e.ctrlKey,
      });
    },
    [toWorld, walls, footprint.floors, v.scale],
  );

  const finish = () => {
    const ui = useVenueUI.getState();
    const made = venueActions.finishWalls(ui.draft);
    ui.setDraft([]);
    if (made.length) ui.select({ kind: 'wall', id: made[made.length - 1].id });
  };
  const addPoint = (p: SnapResult, clicks: number) => {
    const ui = useVenueUI.getState();
    const d = ui.draft;
    const last = d[d.length - 1];
    if (clicks >= 2 || (last && dist(last, p.at) < 0.005)) {
      // Second click of a double-click (or a click on the last corner): finish.
      finish();
      return;
    }
    if (d.length >= 2 && dist(d[0], p.at) < 0.005) {
      venueActions.finishWalls([...d, d[0]]);
      ui.setDraft([]);
      return;
    }
    ui.setDraft([...d, p.at]);
  };

  /** A click (not a drag) with the room, door or furniture tool. */
  const toolClick = (clientX: number, clientY: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    const ui = useVenueUI.getState();
    const p = toWorld(clientX, clientY);
    if (tool === 'room') {
      if (!venueActions.addRoomAt(p, ui.roomType)) ui.setNotice('That spot isn’t closed in by walls. Drag out a rectangle to make a room with its own walls, or close the walls around it first.');
      else ui.setNotice(null);
    } else if (tool === 'door') {
      const near = wallNear(walls, p, 10 / v.scale);
      if (!near) {
        ui.setNotice('Click on a wall to put a door in it.');
        return;
      }
      ui.setNotice(null);
      venueActions.addDoor(near.wall.id, Math.round(near.s / 0.05) * 0.05, ui.doorPreset, near.side);
    } else if (tool === 'route') {
      // A door (by its opening) wins over the room around it.
      const door = doors.find((d) => {
        const w = walls.find((x) => x.id === d.wallId);
        if (!w) return false;
        const [s0, s1] = doorSpan(w, d);
        return dist(wallFrame(w, (s0 + s1) / 2).at, p) < (s1 - s0) / 2 + 10 / v.scale;
      });
      const room = door ? undefined : roomAt(walls, rooms, p);
      const end: RouteEnd | null = door ? { kind: 'door', id: door.id } : room ? { kind: 'room', id: room.id } : null;
      if (!end) {
        ui.setNotice('Click a room or a door.');
        return;
      }
      if (!ui.routeStart) {
        ui.setRouteStart(end);
        ui.setNotice('Now click where the route ends.');
        return;
      }
      if (ui.routeStart.kind === end.kind && ui.routeStart.id === end.id) return;
      const route = venueActions.addRoute(ui.routeStart, end);
      ui.setRouteStart(null);
      const res = solveRoute(useProjectStore.getState().venue, route);
      ui.setNotice(res.path ? null : 'No way through — add a door between those rooms.');
    } else if (tool === 'calibrate') {
      const pts = [...ui.calPoints, p].slice(-2);
      ui.setCalPoints(pts);
    } else if (tool === 'furniture') {
      const at = snapAt(clientX, clientY, e, { noAngle: true }).at;
      const place = placeFurniture(walls, ui.furnitureType, at);
      venueActions.addFurniture(ui.furnitureType, place.at, place.rotation);
    }
  };

  // Keys (Venue mode only, while not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const ui = useVenueUI.getState();
      if (e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (ui.draft.length) ui.setDraft([]);
        else if (ui.tool !== 'select') ui.setTool('select');
        else ui.select(null);
      } else if (e.key === 'Enter' && ui.draft.length) finish();
      else if ((e.key === 'Backspace' || e.key === 'Delete') && ui.draft.length) {
        e.preventDefault();
        ui.setDraft(ui.draft.slice(0, -1));
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && ui.selected) {
        e.preventDefault();
        venueActions.removeSelected();
      } else if (k === 'r' && ui.selected?.kind === 'furniture') {
        const f = useProjectStore.getState().venue.furniture.find((x) => x.id === ui.selected!.id);
        if (f) venueActions.patchFurniture(f.id, { rotation: (((f.rotation + (e.shiftKey ? 15 : 90) + 180) % 360) + 360) % 360 - 180 });
      } else if (k === 'w') ui.setTool('wall');
      else if (k === 'v') ui.setTool('select');
      else if (k === 'm') ui.setTool('room');
      else if (k === 'd') ui.setTool('door');
      else if (k === 'f') ui.setTool('furniture');
      else if (k === 'p') ui.setTool('route');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    svg.current!.setPointerCapture(e.pointerId);
    const panning = e.button === 1 || e.button === 2;
    if (!panning && tool === 'select') {
      const endEl = target.closest('[data-end]');
      if (endEl) {
        const from = (endEl.getAttribute('data-end') ?? '').split(',').map(Number) as Pt;
        drag.current = { kind: 'end', from, moved: false, key: `wall-end:${Date.now()}` };
        return;
      }
      const doorEl = target.closest('[data-door]');
      const door = doorEl && doors.find((d) => d.id === doorEl.getAttribute('data-door'));
      const doorWall = door && walls.find((w) => w.id === door.wallId);
      if (door && doorWall) {
        useVenueUI.getState().select({ kind: 'door', id: door.id });
        drag.current = { kind: 'door', door, wall: doorWall, moved: false, key: `door-move:${door.id}:${Date.now()}` };
        return;
      }
      const fEl = target.closest('[data-furniture]');
      const item = fEl && furniture.find((f) => f.id === fEl.getAttribute('data-furniture'));
      if (item) {
        useVenueUI.getState().select({ kind: 'furniture', id: item.id });
        drag.current = { kind: 'furniture', start: toWorld(e.clientX, e.clientY), item, moved: false, key: `furn-move:${item.id}:${Date.now()}` };
        return;
      }
      const wallEl = target.closest('[data-wall]');
      const w = wallEl && walls.find((x) => x.id === wallEl.getAttribute('data-wall'));
      if (w) {
        useVenueUI.getState().select({ kind: 'wall', id: w.id });
        drag.current = { kind: 'wall', start: toWorld(e.clientX, e.clientY), wall: w, moved: false, key: `wall-move:${w.id}:${Date.now()}` };
        return;
      }
      const routeEl = target.closest('[data-route]');
      if (routeEl) {
        useVenueUI.getState().select({ kind: 'route', id: routeEl.getAttribute('data-route')! });
        drag.current = { kind: 'pan', start: [e.clientX, e.clientY], view: v, moved: false };
        return;
      }
      const traceEl = target.closest('[data-trace]');
      if (traceEl && venue.trace && !venue.trace.locked) {
        drag.current = { kind: 'trace', start: toWorld(e.clientX, e.clientY), trace: venue.trace, moved: false, key: `trace-move:${Date.now()}` };
        return;
      }
      const roomEl = target.closest('[data-room]');
      if (roomEl) {
        useVenueUI.getState().select({ kind: 'room', id: roomEl.getAttribute('data-room')! });
        drag.current = { kind: 'pan', start: [e.clientX, e.clientY], view: v, moved: false };
        return;
      }
    }
    if (!panning && tool === 'room') {
      drag.current = { kind: 'rect', start: snapAt(e.clientX, e.clientY, e, { noAngle: true }).at, startPx: [e.clientX, e.clientY], moved: false };
      return;
    }
    drag.current = panning || tool === 'select' ? { kind: 'pan', start: [e.clientX, e.clientY], view: v, moved: false } : { kind: 'click', start: [e.clientX, e.clientY], moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const world = toWorld(e.clientX, e.clientY);
    setPointer(world);
    if (tool === 'wall') useVenueUI.getState().setHover(snapAt(e.clientX, e.clientY, e));
    if (!d) {
      const t = e.target as Element;
      setCursor(tool !== 'select' ? 'crosshair' : t.closest('[data-end]') ? 'grab' : t.closest('[data-wall],[data-door],[data-furniture],[data-trace]') ? 'move' : t.closest('[data-room]') ? 'pointer' : 'default');
      return;
    }
    if (d.kind === 'rect') {
      if (!d.moved && Math.hypot(e.clientX - d.startPx[0], e.clientY - d.startPx[1]) < 4) return;
      d.moved = true;
      setRectEnd(snapAt(e.clientX, e.clientY, e, { noAngle: true }).at);
      return;
    }
    if (d.kind === 'pan' || d.kind === 'click') {
      const dx = e.clientX - d.start[0];
      const dy = e.clientY - d.start[1];
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      if (d.kind === 'click') {
        // Dragging with a drawing tool pans too.
        drag.current = { kind: 'pan', start: d.start, view: v, moved: true };
        return;
      }
      setView({ ...d.view, cx: d.view.cx - dx / d.view.scale, cz: d.view.cz - dy / d.view.scale });
      return;
    }
    const g = planGrid();
    if (d.kind === 'wall' || d.kind === 'furniture') {
      const dx = Math.round((world[0] - d.start[0]) / g) * g;
      const dz = Math.round((world[1] - d.start[1]) / g) * g;
      if (!d.moved && Math.hypot(dx, dz) < g) return;
      d.moved = true;
      if (d.kind === 'wall') venueActions.moveWall(d.wall, dx, dz, d.key);
      else venueActions.patchFurniture(d.item.id, { x: d.item.x + dx, z: d.item.z + dz }, d.key);
      return;
    }
    if (d.kind === 'trace') {
      const dx = world[0] - d.start[0];
      const dz = world[1] - d.start[1];
      if (!d.moved && Math.hypot(dx, dz) * v.scale < 3) return;
      d.moved = true;
      patchTrace({ x: d.trace.x + dx, z: d.trace.z + dz }, d.key);
      return;
    }
    if (d.kind === 'door') {
      const q = projectOnWall(d.wall, world);
      const s = Math.round(q.s / 0.05) * 0.05;
      if (!d.moved && Math.abs(s - d.door.s) < 0.05) return;
      d.moved = true;
      venueActions.patchDoor(d.door.id, { s }, d.key);
      return;
    }
    if (d.kind === 'end') {
      const from = d.from;
      // Don't snap onto the walls being dragged.
      const s = snapAt(e.clientX, e.clientY, e, { exclude: (w) => dist(w.a, from) < 0.01 || dist(w.b, from) < 0.01, noAngle: true });
      if (!d.moved && dist(s.at, from) < 0.01) return;
      d.moved = true;
      venueActions.moveEnd(from, s.at, d.key);
      d.from = s.at;
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'rect') {
      setRectEnd(null);
      if (d.moved) {
        const end = snapAt(e.clientX, e.clientY, e, { noAngle: true }).at;
        if (!venueActions.addRoomRect(d.start, end, useVenueUI.getState().roomType)) useVenueUI.getState().setNotice('Drag out a bigger rectangle (at least 0.5 m each way).');
        else useVenueUI.getState().setNotice(null);
      } else clickPending.current = true;
      return;
    }
    if (d.kind === 'click' && !d.moved && e.button === 0 && tool !== 'select') clickPending.current = true;
    if (d.kind === 'pan' && !d.moved && e.button === 0 && tool === 'select' && !(e.target as Element).closest('[data-room],[data-route]')) useVenueUI.getState().select(null);
  };

  const rooms2 = useMemo(() => rooms.map((r) => ({ r, ...roomOutline(walls, r) })), [rooms, walls]);
  const pieces = useMemo(() => walls.map((w) => ({ w, ...wallPieces(walls, w, doors) })), [walls, doors]);
  const sel = selected?.kind === 'wall' ? walls.find((w) => w.id === selected.id) : undefined;
  const preview = tool === 'wall' && hover && draft.length ? [...draft, hover.at] : draft;
  const pts = (p: Pt[]) => p.map(([x, z]) => `${x},${z}`).join(' ');
  const doorHover = tool === 'door' && pointer ? wallNear(walls, pointer, 10 / v.scale) : null;
  const ghost = tool === 'furniture' && pointer ? placeFurniture(walls, furnitureType, [Math.round(pointer[0] / planGrid()) * planGrid(), Math.round(pointer[1] / planGrid()) * planGrid()]) : null;
  const rectStart = drag.current?.kind === 'rect' ? drag.current.start : null;

  return (
    <>
      <svg
        ref={svg}
        className="plan"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          useVenueUI.getState().setHover(null);
          setPointer(null);
        }}
        onClick={(e) => {
          // Corners and tool clicks happen on click (after pointer up), so a double-click's second click can finish a wall.
          if (!clickPending.current) return;
          clickPending.current = false;
          if (tool === 'wall') addPoint(snapAt(e.clientX, e.clientY, e), e.detail);
          else toolClick(e.clientX, e.clientY, e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Venue floor plan"
      >
        <g transform={`translate(${size.w / 2} ${size.h / 2}) scale(${v.scale}) translate(${-v.cx} ${-v.cz})`}>
          <Grid view={v} w={size.w} h={size.h} />
          {venue.trace && !venue.trace.hidden && traceUrl && (
            <image
              href={traceUrl}
              x={venue.trace.x}
              y={venue.trace.z}
              width={venue.trace.width * venue.trace.mPerPx}
              height={venue.trace.height * venue.trace.mPerPx}
              opacity={venue.trace.opacity}
              preserveAspectRatio="none"
              className="plan-trace"
              data-trace={selected?.kind === 'trace' && !venue.trace.locked ? '1' : undefined}
              style={{ pointerEvents: selected?.kind === 'trace' && !venue.trace.locked && tool === 'select' ? 'auto' : 'none' }}
            />
          )}
          {venue.trace && selected?.kind === 'trace' && !venue.trace.hidden && (
            <rect x={venue.trace.x} y={venue.trace.z} width={venue.trace.width * venue.trace.mPerPx} height={venue.trace.height * venue.trace.mPerPx} className="plan-trace-frame" style={{ strokeWidth: 2 / v.scale }} pointerEvents="none" />
          )}
          {/* Stage and seating footprint (read-only). */}
          <g className="plan-footprint">
            {footprint.floors.map((f, i) => (
              <polygon key={i} points={pts(f)} />
            ))}
            <path d={footprint.seats} className="plan-seats" />
          </g>
          {rooms2.map(({ r, polygon, closed }) => (
            <polygon
              key={r.id}
              data-room={r.id}
              points={pts(polygon)}
              className={`plan-room ${selected?.kind === 'room' && selected.id === r.id ? 'is-selected' : ''} ${closed ? '' : 'is-open'}`}
              style={{ fill: ROOM_TYPES[r.type]?.color, strokeWidth: 2 / v.scale }}
            />
          ))}
          {pieces.map(({ w, solids }) =>
            solids.map((poly, i) => (
              <polygon key={`${w.id}:${i}`} data-wall={w.id} points={pts(poly)} className={`plan-wall ${sel?.id === w.id ? 'is-selected' : ''}`} style={{ fill: sel?.id === w.id ? ACCENT : WALL_MATERIALS[w.material]?.plan }} />
            )),
          )}
          {doors.map((d) => {
            const w = walls.find((x) => x.id === d.wallId);
            return w ? <DoorSymbol key={d.id} wall={w} door={d} scale={v.scale} selected={selected?.kind === 'door' && selected.id === d.id} /> : null;
          })}
          {furniture.map((f) => (
            <FurnitureSymbol key={f.id} item={f} scale={v.scale} selected={selected?.kind === 'furniture' && selected.id === f.id} />
          ))}
          {venue.routes.map((r) => {
            const isSel = selected?.kind === 'route' && selected.id === r.id;
            if (!r.visible && !isSel) return null;
            const res = solveRoute(venue, r);
            if (!res.path) return null;
            const mid = res.path[Math.floor(res.path.length / 2)];
            const prev = res.path[Math.max(0, Math.floor(res.path.length / 2) - 1)];
            const at: Pt = res.path.length === 2 ? [(res.path[0][0] + res.path[1][0]) / 2, (res.path[0][1] + res.path[1][1]) / 2] : mid ?? prev;
            return (
              <g key={r.id} data-route={r.id} className={`plan-route ${res.audience.length ? 'is-warning' : ''} ${isSel ? 'is-selected' : ''}`}>
                <polyline points={pts(res.path)} className="plan-route__hit" style={{ strokeWidth: 12 / v.scale }} />
                <polyline points={pts(res.path)} style={{ strokeWidth: (isSel ? 4 : 3) / v.scale }} />
                <polygon points={pts(arrowHead(res.path, 12 / v.scale))} className="plan-route__head" />
                <circle cx={res.path[0][0]} cy={res.path[0][1]} r={4 / v.scale} />
                <Label at={[at[0], at[1] - 12 / v.scale]} text={`${formatLength(res.length, units)} · ${formatTime(res.length / WALK)}`} scale={v.scale} accent={isSel} />
              </g>
            );
          })}
          {rooms2.map(({ r, polygon }) => {
            const c = centroid(polygon);
            return (
              <g key={`l${r.id}`} pointerEvents="none">
                <Label at={[c[0], c[1] - 7 / v.scale]} text={r.name} scale={v.scale} />
                <Label at={[c[0], c[1] + 7 / v.scale]} text={formatArea(polygonArea(polygon), units)} scale={v.scale} />
              </g>
            );
          })}
          {sel && (
            <>
              <Label at={[(sel.a[0] + sel.b[0]) / 2, (sel.a[1] + sel.b[1]) / 2 - 12 / v.scale]} text={formatLength(wallLength(sel), units)} scale={v.scale} accent />
              {[sel.a, sel.b].map((p, i) => (
                <circle key={i} data-end={`${p[0]},${p[1]}`} cx={p[0]} cy={p[1]} r={6 / v.scale} className="plan-handle" style={{ strokeWidth: 2 / v.scale }} />
              ))}
            </>
          )}
          {/* Tool previews */}
          {preview.length > 1 && <polyline points={pts(preview)} className="plan-draft" style={{ strokeWidth: 2 / v.scale }} />}
          {preview.slice(1).map((p, i) => (
            <Label key={i} at={[(preview[i][0] + p[0]) / 2, (preview[i][1] + p[1]) / 2 - 10 / v.scale]} text={formatLength(dist(preview[i], p), units)} scale={v.scale} accent={i === preview.length - 2} />
          ))}
          {draft.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={(i === 0 ? 5 : 3.5) / v.scale} className="plan-corner" style={{ strokeWidth: 1.5 / v.scale }} />
          ))}
          {tool === 'wall' && hover && <circle cx={hover.at[0]} cy={hover.at[1]} r={(hover.kind === 'end' || hover.kind === 'stage' ? 7 : 4) / v.scale} className={`plan-snap is-${hover.kind}`} style={{ strokeWidth: 2 / v.scale }} />}
          {rectStart && rectEnd && (
            <>
              <rect x={Math.min(rectStart[0], rectEnd[0])} y={Math.min(rectStart[1], rectEnd[1])} width={Math.abs(rectEnd[0] - rectStart[0])} height={Math.abs(rectEnd[1] - rectStart[1])} className="plan-draft is-rect" style={{ strokeWidth: 2 / v.scale }} />
              <Label at={[(rectStart[0] + rectEnd[0]) / 2, Math.min(rectStart[1], rectEnd[1]) - 10 / v.scale]} text={formatLength(Math.abs(rectEnd[0] - rectStart[0]), units)} scale={v.scale} accent />
              <Label at={[Math.max(rectStart[0], rectEnd[0]) + 22 / v.scale, (rectStart[1] + rectEnd[1]) / 2]} text={formatLength(Math.abs(rectEnd[1] - rectStart[1]), units)} scale={v.scale} accent />
            </>
          )}
          {doorHover && (() => {
            const fr = wallFrame(doorHover.wall, doorHover.s);
            return <circle cx={fr.at[0]} cy={fr.at[1]} r={6 / v.scale} className="plan-snap is-end" style={{ strokeWidth: 2 / v.scale }} />;
          })()}
          {tool === 'route' && routeStart && (() => {
            const p = endPoint(venue, routeStart);
            return p ? <circle cx={p[0]} cy={p[1]} r={8 / v.scale} className="plan-snap is-end" style={{ strokeWidth: 3 / v.scale }} /> : null;
          })()}
          {tool === 'calibrate' && calPoints.length > 0 && (
            <g className="plan-cal">
              {calPoints.length === 2 && <line x1={calPoints[0][0]} y1={calPoints[0][1]} x2={calPoints[1][0]} y2={calPoints[1][1]} style={{ strokeWidth: 2 / v.scale }} />}
              {calPoints.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={5 / v.scale} style={{ strokeWidth: 2 / v.scale }} />
              ))}
            </g>
          )}
          {ghost && <FurnitureSymbol item={{ id: 'ghost', type: furnitureType, x: ghost.at[0], z: ghost.at[1], rotation: ghost.rotation }} scale={v.scale} ghost />}
        </g>
        <ScaleBar scale={v.scale} units={units} h={size.h} />
        <foreignObject x={size.w - 44} y={size.h - 44} width={36} height={36}>
          <button className="btn btn--icon plan-fit" onClick={fit} title="Fit the plan to the view" aria-label="Fit plan">
            ⤢
          </button>
        </foreignObject>
      </svg>
      {tool === 'calibrate' && calPoints.length === 2 && <CalibrateDialog a={calPoints[0]} b={calPoints[1]} />}
      {notice && (
        <div className="plan-notice" role="status">
          {notice}
          <button onClick={() => useVenueUI.getState().setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </>
  );
}

function ScaleBar({ scale, units, h }: { scale: number; units: 'm' | 'ft'; h: number }) {
  // A round length about 80–160 px long.
  const target = 110 / scale;
  const unitM = units === 'ft' ? 0.3048 : 1;
  const steps = [1, 2, 5, 10, 20, 50, 100, 200];
  const n = steps.find((s) => s * unitM >= target * 0.7) ?? 200;
  const px = n * unitM * scale;
  return (
    <g transform={`translate(14 ${h - 22})`} className="plan-scale">
      <rect x={0} y={0} width={px} height={5} />
      <text x={px + 6} y={6}>
        {n} {units}
      </text>
    </g>
  );
}

/** After clicking two points on the traced plan: how far apart are they really? */
function CalibrateDialog({ a, b }: { a: Pt; b: Pt }) {
  const units = useProjectStore((s) => s.units);
  const measured = dist(a, b);
  const [value, setValue] = useState(() => toDisplay(measured, units).toFixed(2));
  const close = () => useVenueUI.getState().setTool('select');
  const apply = () => {
    const v = parseFloat(value);
    if (!(v > 0)) return;
    calibrateTrace(a, b, fromDisplay(v, units));
    useVenueUI.getState().setNotice(null);
    close();
  };
  return (
    <Modal title="Set the plan’s scale" onClose={close}>
      <p className="modal__text">Type the real distance between the two points you clicked (for example a dimension written on the plan). The image is resized so the plan is true to scale.</p>
      <label className="field">
        <span className="field__label">Real distance ({units})</span>
        <input className="field__input" type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} autoFocus />
      </label>
      <div className="modal__actions">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={apply}>
          Set scale
        </button>
      </div>
    </Modal>
  );
}
