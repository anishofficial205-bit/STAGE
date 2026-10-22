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
import { dist, snapWallPoint, wallLength, wallPolygon, type SnapResult } from '../../venue/geometry';
import { WALL_MATERIALS, type Pt, type Wall } from '../../venue/types';
import { planGrid, venueActions } from '../../venue/actions';
import { useVenueUI } from '../../venue/ui';

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
  | { kind: 'click'; start: [number, number]; moved: boolean };

/** The current stage's floors and seats, for the grey footprint. */
function useFootprint() {
  const templateId = useProjectStore((s) => s.templateId);
  const params = useActiveParams();
  const data = useActiveData();
  return useMemo(() => {
    const t = getTemplate(templateId)!;
    const floors = t.stage?.(params, data).floors.map((f) => f.outline) ?? [];
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

export function PlanView() {
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const units = useProjectStore((s) => s.units);
  const walls = useProjectStore((s) => s.venue.walls);
  const tool = useVenueUI((s) => s.tool);
  const draft = useVenueUI((s) => s.draft);
  const hover = useVenueUI((s) => s.hover);
  const selected = useVenueUI((s) => s.selected);
  const footprint = useFootprint();
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<Drag | null>(null);
  const clickPending = useRef(false);
  const [cursor, setCursor] = useState('default');

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Frame the stage and every wall. */
  const fit = useCallback(() => {
    const { min, max } = footprint.bounds;
    const xs = [min[0], max[0], ...walls.flatMap((w) => [w.a[0], w.b[0]])];
    const zs = [min[2], max[2], ...walls.flatMap((w) => [w.a[1], w.b[1]])];
    const [x0, x1, z0, z1] = [Math.min(...xs) - 3, Math.max(...xs) + 3, Math.min(...zs) - 3, Math.max(...zs) + 3];
    setView({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: Math.max(2, Math.min(size.w / (x1 - x0), size.h / (z1 - z0))) });
  }, [footprint.bounds, walls, size]);
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
    (clientX: number, clientY: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }, exclude?: (w: Wall) => boolean): SnapResult => {
      const d = useVenueUI.getState().draft;
      return snapWallPoint(toWorld(clientX, clientY), d[d.length - 1], {
        walls: exclude ? walls.filter((w) => !exclude(w)) : walls,
        outlines: footprint.floors,
        radius: SNAP_PX / v.scale,
        grid: planGrid(),
        freeAngle: e.shiftKey,
        noSnap: e.metaKey || e.ctrlKey,
      });
    },
    [toWorld, walls, footprint.floors, v.scale],
  );

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
  const finish = () => {
    const ui = useVenueUI.getState();
    const made = venueActions.finishWalls(ui.draft);
    ui.setDraft([]);
    if (made.length) ui.select({ kind: 'wall', id: made[made.length - 1].id });
  };

  // Keys (Venue mode only, while not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const ui = useVenueUI.getState();
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') {
        if (ui.draft.length) ui.setDraft([]);
        else if (ui.tool !== 'select') ui.setTool('select');
        else ui.select(null);
      } else if (e.key === 'Enter' && ui.draft.length) finish();
      else if ((e.key === 'Backspace' || e.key === 'Delete') && ui.draft.length) {
        e.preventDefault();
        ui.setDraft(ui.draft.slice(0, -1));
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && ui.selected?.kind === 'wall') {
        e.preventDefault();
        venueActions.removeWall(ui.selected.id);
      } else if (e.key.toLowerCase() === 'w') ui.setTool('wall');
      else if (e.key.toLowerCase() === 'v') ui.setTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    svg.current!.setPointerCapture(e.pointerId);
    const panning = e.button === 1 || e.button === 2;
    const endEl = target.closest('[data-end]');
    const wallEl = target.closest('[data-wall]');
    if (!panning && tool === 'select' && endEl) {
      const from = (endEl.getAttribute('data-end') ?? '').split(',').map(Number) as Pt;
      drag.current = { kind: 'end', from, moved: false, key: `wall-end:${Date.now()}` };
      return;
    }
    if (!panning && tool === 'select' && wallEl) {
      const w = walls.find((x) => x.id === wallEl.getAttribute('data-wall'));
      if (w) {
        useVenueUI.getState().select({ kind: 'wall', id: w.id });
        drag.current = { kind: 'wall', start: toWorld(e.clientX, e.clientY), wall: w, moved: false, key: `wall-move:${w.id}:${Date.now()}` };
        return;
      }
    }
    drag.current = panning || tool === 'select' ? { kind: 'pan', start: [e.clientX, e.clientY], view: v, moved: false } : { kind: 'click', start: [e.clientX, e.clientY], moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (tool === 'wall') useVenueUI.getState().setHover(snapAt(e.clientX, e.clientY, e));
    if (!d) {
      const t = e.target as Element;
      setCursor(tool === 'wall' ? 'crosshair' : t.closest('[data-end]') ? 'grab' : t.closest('[data-wall]') ? 'move' : 'default');
      return;
    }
    if (d.kind === 'pan' || d.kind === 'click') {
      const dx = e.clientX - d.start[0];
      const dy = e.clientY - d.start[1];
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      if (d.kind === 'click') {
        // Dragging with the wall tool pans too.
        drag.current = { kind: 'pan', start: d.start, view: v, moved: true };
        return;
      }
      setView({ ...d.view, cx: d.view.cx - dx / d.view.scale, cz: d.view.cz - dy / d.view.scale });
      return;
    }
    if (d.kind === 'wall') {
      const p = toWorld(e.clientX, e.clientY);
      const g = planGrid();
      const dx = Math.round((p[0] - d.start[0]) / g) * g;
      const dz = Math.round((p[1] - d.start[1]) / g) * g;
      if (!d.moved && Math.hypot(dx, dz) < g) return;
      d.moved = true;
      venueActions.moveWall(d.wall, dx, dz, d.key);
      return;
    }
    if (d.kind === 'end') {
      const from = d.from;
      // Don't snap onto the walls being dragged.
      const s = snapAt(e.clientX, e.clientY, e, (w) => dist(w.a, from) < 0.01 || dist(w.b, from) < 0.01);
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
    if (d.kind === 'click' && !d.moved && e.button === 0 && tool === 'wall') clickPending.current = true;
    if (d.kind === 'pan' && !d.moved && e.button === 0 && tool === 'select') useVenueUI.getState().select(null);
  };

  const polygons = useMemo(() => walls.map((w) => ({ w, poly: wallPolygon(walls, w) })), [walls]);
  const sel = selected?.kind === 'wall' ? walls.find((w) => w.id === selected.id) : undefined;
  const preview = tool === 'wall' && hover && draft.length ? [...draft, hover.at] : draft;
  const pts = (p: Pt[]) => p.map(([x, z]) => `${x},${z}`).join(' ');

  return (
    <svg
      ref={svg}
      className="plan"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => useVenueUI.getState().setHover(null)}
      onClick={(e) => {
        // Corners go down on click (after pointer up), so a double-click's second click can finish instead.
        if (!clickPending.current) return;
        clickPending.current = false;
        addPoint(snapAt(e.clientX, e.clientY, e), e.detail);
      }}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label="Venue floor plan"
    >
      <g transform={`translate(${size.w / 2} ${size.h / 2}) scale(${v.scale}) translate(${-v.cx} ${-v.cz})`}>
        <Grid view={v} w={size.w} h={size.h} />
        {/* Stage and seating footprint (read-only). */}
        <g className="plan-footprint">
          {footprint.floors.map((f, i) => (
            <polygon key={i} points={pts(f)} />
          ))}
          <path d={footprint.seats} className="plan-seats" />
        </g>
        {polygons.map(({ w, poly }) => (
          <polygon key={w.id} data-wall={w.id} points={pts(poly)} className={`plan-wall ${sel?.id === w.id ? 'is-selected' : ''}`} style={{ fill: sel?.id === w.id ? ACCENT : WALL_MATERIALS[w.material]?.plan }} />
        ))}
        {sel && (
          <>
            <Label at={[(sel.a[0] + sel.b[0]) / 2, (sel.a[1] + sel.b[1]) / 2 - 12 / v.scale]} text={formatLength(wallLength(sel), units)} scale={v.scale} accent />
            {[sel.a, sel.b].map((p, i) => (
              <circle key={i} data-end={`${p[0]},${p[1]}`} cx={p[0]} cy={p[1]} r={6 / v.scale} className="plan-handle" style={{ strokeWidth: 2 / v.scale }} />
            ))}
          </>
        )}
        {preview.length > 1 && <polyline points={pts(preview)} className="plan-draft" style={{ strokeWidth: 2 / v.scale }} />}
        {preview.slice(1).map((p, i) => (
          <Label key={i} at={[(preview[i][0] + p[0]) / 2, (preview[i][1] + p[1]) / 2 - 10 / v.scale]} text={formatLength(dist(preview[i], p), units)} scale={v.scale} accent={i === preview.length - 2} />
        ))}
        {draft.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={(i === 0 ? 5 : 3.5) / v.scale} className="plan-corner" style={{ strokeWidth: 1.5 / v.scale }} />
        ))}
        {tool === 'wall' && hover && <circle cx={hover.at[0]} cy={hover.at[1]} r={(hover.kind === 'end' || hover.kind === 'stage' ? 7 : 4) / v.scale} className={`plan-snap is-${hover.kind}`} style={{ strokeWidth: 2 / v.scale }} />}
      </g>
      <ScaleBar scale={v.scale} units={units} h={size.h} />
      <foreignObject x={size.w - 44} y={size.h - 44} width={36} height={36}>
        <button className="btn btn--icon plan-fit" onClick={fit} title="Fit the plan to the view" aria-label="Fit plan">
          ⤢
        </button>
      </foreignObject>
    </svg>
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
