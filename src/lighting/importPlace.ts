/**
 * Putting imported lights on the stage (from a spreadsheet or an MVR file).
 *
 * Lights with coordinates go where they say; lights in the same row (same
 * height and depth) share a bar, named after the position the file gives.
 * Lights with only a position name ("1st Electric", unit 5) go on that bar —
 * an existing one with the same name, or a new one — spaced out in unit
 * order. Anything else goes on the least busy bar over the stage.
 */
import { useProjectStore } from '../store/useProjectStore';
import { currentStage } from '../objects/actions';
import { playingArea } from '../objects/curtains/drapes';
import { floorHeightAt } from '../helpers/stageInfo';
import { HANG_DROP, positionLine, stageCentre } from './hang';
import { lightActions } from './actions';
import { useLightsUI } from './ui';
import { FIXTURES, emptyLighting, lightId, type Fixture, type FixtureType, type HangPosition, type Lighting, type Vec3 } from './types';

export interface ImportLight {
  channel?: number;
  name?: string;
  /** What the file calls it (make and model, or a kind). */
  typeText?: string;
  type: FixtureType;
  /** False: a stand-in (we didn't recognise the kind). */
  known: boolean;
  position?: string;
  unit?: number;
  /** World position (metres), when the file has coordinates. */
  pos?: Vec3;
  target?: Vec3;
  color?: string;
  gel?: string;
  intensity?: number;
  beam?: number;
  purpose?: string;
}

/** How the file's coordinates map onto the stage. */
export interface CoordSystem {
  /** Metres per file unit. */
  scale: number;
  /** Which file axis is height. */
  up: 'z' | 'y';
}

/** File coordinates (origin at the centre of the front edge of the stage, depth positive upstage) → world. */
export function toWorld(v: [number, number, number], c: CoordSystem): Vec3 {
  const { info } = currentStage();
  const a = playingArea(info);
  const floor = floorHeightAt(info, a.cx, (a.front + a.back) / 2);
  const [x, d, h] = c.up === 'z' ? [v[0], v[1], v[2]] : [v[0], v[2], v[1]];
  // Upstage is −z in the world (the audience is towards +z).
  const sign = a.back < a.front ? -1 : 1;
  return [a.cx + x * c.scale, floor + h * c.scale, a.front + sign * d * c.scale];
}

const MM: Record<string, string> = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6', '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', '5th': '5', '6th': '6' };

/** "1st Electric", "Elec 1", "1 ELEC" → the same key. */
export function positionKey(name: string) {
  const words = name
    .toLowerCase()
    .replace(/electrics?|elec\.?|lx/g, ' electric ')
    .replace(/front of house/g, ' foh ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => MM[w] ?? w);
  return words.sort().join(' ');
}

function kindOf(name: string): HangPosition['kind'] | 'floor' {
  const n = name.toLowerCase();
  if (/floor|deck|ground|stand/.test(n)) return 'floor';
  if (/boom|ladder|pole|tower|pipe end|torm/.test(n)) return 'boom';
  if (/foh|front of house|balcony|box|cove|catwalk|beam|bridge|house/.test(n)) return 'foh';
  return 'electric';
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Put imported lights on the stage (one undo step). Returns how many were placed. */
export function placeImported(rows: ImportLight[], replace: boolean, label: string) {
  const s = useProjectStore.getState();
  lightActions.ensureReady();
  const before = s.lightingByTemplate[s.templateId] ?? emptyLighting();
  const base: Lighting = replace ? { ...before, fixtures: [], positions: [], looks: [], groups: [], ready: true } : before;
  const positions = [...base.positions];
  const fixtures: Fixture[] = [];
  const c = stageCentre();
  const { info } = currentStage();
  const a = playingArea(info);
  const top = floorHeightAt(info, a.cx, (a.front + a.back) / 2) + Math.max(5, a.height + 1.5);
  const upstage = a.back < a.front ? -1 : 1;
  let channel = base.fixtures.reduce((m, f) => Math.max(m, f.channel), 0);
  const taken = new Set(base.fixtures.map((f) => f.channel));
  const nextChannel = (want?: number) => {
    if (want && want > 0 && !taken.has(want)) return taken.add(want), want;
    while (taken.has(++channel));
    taken.add(channel);
    return channel;
  };

  const findPosition = (name: string) => positions.find((p) => positionKey(p.name) === positionKey(name));
  const newPosition = (name: string, kind: HangPosition['kind'], at?: { x: number; y: number; z: number; length: number }) => {
    const same = positions.filter((p) => p.kind === kind);
    const n = same.length;
    const p: HangPosition = at
      ? { id: lightId('h'), kind, name, ...at }
      : kind === 'boom'
        ? { id: lightId('h'), kind, name, x: a.cx + (n % 2 ? -1 : 1) * (a.width / 2 + 1.2), y: c[1], z: (a.front + a.back) / 2, length: 4 }
        : kind === 'foh'
          ? { id: lightId('h'), kind, name, x: a.cx, y: top + 0.5, z: a.front - upstage * (5 + n * 2), length: a.width + 2 }
          : { id: lightId('h'), kind, name, x: a.cx, y: top, z: a.front + upstage * (1 + n * 1.5), length: a.width + 4 };
    positions.push(p);
    return p;
  };
  const aimFor = (type: FixtureType, pos: Vec3): Vec3 =>
    type === 'cyc' ? [pos[0], c[1], pos[2] + upstage * 3] : type === 'uplight' ? [pos[0], pos[1] + 5, pos[2] + upstage] : FIXTURES[type].point ? pos : [pos[0] * 0.6 + c[0] * 0.4, c[1], c[2]];

  const make = (r: ImportLight, pos: Vec3, mount: string | null): Fixture => {
    const spec = FIXTURES[r.type];
    const beam = r.beam && spec.beam[1] ? Math.min(spec.beam[1], Math.max(spec.beam[0], r.beam)) : spec.beam[2];
    return {
      id: lightId('l'),
      type: r.type,
      name: r.name?.trim() || spec.label.split(' /')[0],
      channel: nextChannel(r.channel),
      pos,
      mount,
      target: r.target ?? aimFor(r.type, pos),
      beam,
      soft: spec.soft,
      intensity: r.intensity ?? (r.type === 'house' ? 70 : 80),
      on: true,
      color: r.color ?? '#ffffff',
      ...(r.gel ? { gel: r.gel } : {}),
      castShadow: !spec.point && r.type !== 'house' && r.type !== 'cyc',
      ...(r.purpose ? { purpose: r.purpose } : {}),
      ...(r.typeText && (!r.known || r.typeText.toLowerCase() !== spec.label.toLowerCase()) ? { standIn: r.typeText } : {}),
    };
  };

  // 1. Lights with coordinates: rows of lights at the same height and depth share a bar.
  const placed = rows.filter((r) => r.pos);
  const rowsOf = new Map<string, ImportLight[]>();
  for (const r of placed) {
    const [, y, z] = r.pos!;
    const k = `${Math.round(y / 0.4)}:${Math.round(z / 0.4)}`;
    rowsOf.set(k, [...(rowsOf.get(k) ?? []), r]);
  }
  for (const group of rowsOf.values()) {
    const floorish = group.every((r) => r.pos![1] < c[1] + 1.2);
    if (floorish) {
      for (const r of group) fixtures.push(make(r, r.pos!, 'floor'));
      continue;
    }
    if (group.length < 2) {
      const r = group[0];
      const named = r.position ? findPosition(r.position) : undefined;
      fixtures.push(make(r, r.pos!, named?.id ?? null));
      continue;
    }
    const xs = group.map((r) => r.pos![0]);
    const names = group.map((r) => r.position).filter(Boolean) as string[];
    const name = names.length ? names.sort((p, q) => names.filter((n) => n === q).length - names.filter((n) => n === p).length)[0] : `Bar ${positions.length + 1}`;
    const y = median(group.map((r) => r.pos![1])) + HANG_DROP;
    const z = median(group.map((r) => r.pos![2]));
    const kind = kindOf(name);
    const existing = findPosition(name);
    const bar =
      existing && Math.abs(existing.z - z) < 0.5 && Math.abs(existing.y - y) < 0.6
        ? existing
        : newPosition(existing ? `${name} (2)` : name, kind === 'floor' || kind === 'boom' ? 'electric' : kind, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y, z, length: Math.max(2, Math.max(...xs) - Math.min(...xs) + 1) });
    for (const r of group) fixtures.push(make(r, r.pos!, bar.id));
  }

  // 2. Lights with a position name (and maybe a unit number) but no coordinates.
  const byPosition = new Map<string, ImportLight[]>();
  for (const r of rows.filter((x) => !x.pos && x.position?.trim())) byPosition.set(r.position!.trim(), [...(byPosition.get(r.position!.trim()) ?? []), r]);
  for (const [name, group] of byPosition) {
    const kind = kindOf(name);
    if (kind === 'floor') {
      group.forEach((r, i) => {
        const at: Vec3 = [c[0] + (i - (group.length - 1) / 2) * 0.8, c[1] + 0.05, a.front + upstage * 0.6];
        fixtures.push(make(r, at, 'floor'));
      });
      continue;
    }
    const p = findPosition(name) ?? newPosition(name, kind);
    const sorted = [...group].sort((q, r) => (q.unit ?? 0) - (r.unit ?? 0));
    const line = positionLine(p);
    sorted.forEach((r, i) => {
      const t = (i + 1) / (sorted.length + 1);
      const pos: Vec3 = p.kind === 'boom' ? [p.x, line.a[1] + p.length * (1 - t), p.z] : [line.a[0] + (line.b[0] - line.a[0]) * t, p.y - HANG_DROP, p.z];
      fixtures.push(make(r, pos, p.id));
    });
  }

  // 3. Everything else: spread over the bars above the stage.
  const rest = rows.filter((x) => !x.pos && !x.position?.trim());
  if (rest.length) {
    let bars = positions.filter((p) => p.kind === 'electric');
    if (!bars.length) bars = [newPosition('1st Electric', 'electric')];
    const per = Math.ceil(rest.length / bars.length);
    bars.forEach((p, b) => {
      const mine = rest.slice(b * per, (b + 1) * per);
      const line = positionLine(p);
      const already = fixtures.filter((f) => f.mount === p.id).length + base.fixtures.filter((f) => f.mount === p.id).length;
      mine.forEach((r, i) => {
        const t = (already + i + 1) / (already + mine.length + 1);
        const pos: Vec3 = [line.a[0] + (line.b[0] - line.a[0]) * t, p.y - HANG_DROP, p.z];
        fixtures.push(make(r, FIXTURES[r.type].mount === 'floor' ? [pos[0], c[1] + 0.05, a.front + upstage * 0.6] : pos, FIXTURES[r.type].mount === 'floor' ? 'floor' : p.id));
      });
    });
  }

  s.batch(label, () => s.setLighting(() => ({ ...base, positions, fixtures: [...base.fixtures, ...fixtures], ready: true })));
  useLightsUI.getState().select(null);
  return fixtures.length;
}
