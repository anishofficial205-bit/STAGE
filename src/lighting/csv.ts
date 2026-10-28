/**
 * The light list as a spreadsheet: export every light (it can be imported
 * again), and read anyone's light list — a CSV from a paperwork program or a
 * lighting console — with the columns matched to ours.
 */
import { useProjectStore } from '../store/useProjectStore';
import { blocking } from '../blocking/actions';
import { currentStage } from '../objects/actions';
import { playingArea } from '../objects/curtains/drapes';
import { floorHeightAt } from '../helpers/stageInfo';
import { FIXTURES, GELS, emptyLighting, type FixtureType, type Vec3 } from './types';
import { toWorld, type CoordSystem, type ImportLight } from './importPlace';

const q = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const EXPORT_HEAD = ['Channel', 'Name', 'Kind', 'Make and model', 'Position', 'Unit', 'X (m)', 'Depth (m)', 'Height (m)', 'Aim X (m)', 'Aim depth (m)', 'Aim height (m)', 'Colour', 'Gel', 'Brightness (%)', 'Beam (°)', 'Purpose', 'Follows'];

/** World → the file's coordinates (metres from the centre of the front edge of the stage, depth upstage, height above the stage floor). */
function toFile(v: Vec3): [number, number, number] {
  const { info } = currentStage();
  const a = playingArea(info);
  const floor = floorHeightAt(info, a.cx, (a.front + a.back) / 2);
  const sign = a.back < a.front ? -1 : 1;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [r(v[0] - a.cx), r((v[2] - a.front) * sign), r(v[1] - floor)];
}

/** Download every light as a CSV that this app (and spreadsheets) can read. */
export function exportLightList() {
  const s = useProjectStore.getState();
  const l = s.lightingByTemplate[s.templateId] ?? emptyLighting();
  const performers = blocking().performers;
  const unit = new Map<string, number>();
  for (const p of l.positions) {
    l.fixtures
      .filter((f) => f.mount === p.id)
      .sort((a, b) => (p.kind === 'boom' ? b.pos[1] - a.pos[1] : a.pos[0] - b.pos[0]))
      .forEach((f, i) => unit.set(f.id, i + 1));
  }
  const rows = [...l.fixtures]
    .sort((a, b) => a.channel - b.channel)
    .map((f) => [
      f.channel,
      f.name,
      FIXTURES[f.type].label,
      f.standIn ?? '',
      f.mount === 'floor' ? 'Floor' : f.mount === 'rig' ? 'Rigging' : l.positions.find((p) => p.id === f.mount)?.name ?? '',
      unit.get(f.id) ?? '',
      ...toFile(f.pos),
      ...toFile(f.target),
      f.color.toUpperCase(),
      f.gel ?? '',
      f.on ? Math.round(f.intensity) : 0,
      FIXTURES[f.type].point ? '' : Math.round(f.beam),
      f.purpose ?? '',
      performers.find((p) => p.id === f.follow)?.name ?? '',
    ]);
  const text = [EXPORT_HEAD, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = `${(s.projectName || 'stage').replace(/[^\w -]+/g, '').trim() || 'stage'} lights.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- Reading -----------------------------------------------------------------

/** Parse CSV / TSV / semicolon-separated text (quotes, doubled quotes and line breaks in quotes). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
  return rows;
}

export type FieldKey = 'channel' | 'name' | 'type' | 'model' | 'position' | 'unit' | 'x' | 'y' | 'z' | 'ax' | 'ay' | 'az' | 'colour' | 'gel' | 'level' | 'beam' | 'purpose';

export const FIELDS: { key: FieldKey; label: string; help: string; match: RegExp }[] = [
  { key: 'channel', label: 'Channel', help: 'The number the light is controlled by', match: /^(chan(nel)?|ch|fixture ?(id|#|no|number)|#|no\.?|light ?#?)$/i },
  { key: 'name', label: 'Name', help: 'What the light is called', match: /^(name|label|fixture ?name|description)$/i },
  { key: 'type', label: 'Kind', help: 'e.g. Fresnel, PAR, Profile — or the model, if that’s all there is', match: /^(kind|type|instrument( ?type)?|fixture( ?type)?|unit ?type)$/i },
  { key: 'model', label: 'Make and model', help: 'e.g. “ETC Source Four 26°”', match: /^(make and model|model|make|manufacturer and model|gdtf|fixture model)$/i },
  { key: 'position', label: 'Position', help: 'The bar or place it hangs: “1st Electric”', match: /^(position|pos|location|hang(ing)? ?position|pipe|batten|layer)$/i },
  { key: 'unit', label: 'Unit number', help: 'Its place along the bar', match: /^(unit|unit ?#|unit ?(no|number)|u#)$/i },
  { key: 'x', label: 'Across (X)', help: 'Left–right distance from centre', match: /^(x|x ?\(.*\)|pos(ition)? ?x|across|offset ?x)$/i },
  { key: 'y', label: 'Depth (Y)', help: 'Distance upstage of the front edge', match: /^(y|y ?\(.*\)|depth|depth ?\(.*\)|pos(ition)? ?y|offset ?y|upstage)$/i },
  { key: 'z', label: 'Height (Z)', help: 'Height above the stage floor', match: /^(z|z ?\(.*\)|height|height ?\(.*\)|pos(ition)? ?z|trim|elevation)$/i },
  { key: 'ax', label: 'Aim across', help: 'Where it points: across', match: /^(aim ?x|aim ?x ?\(.*\)|focus ?x|target ?x)$/i },
  { key: 'ay', label: 'Aim depth', help: 'Where it points: depth', match: /^(aim ?(y|depth)|aim ?depth ?\(.*\)|focus ?y|target ?y)$/i },
  { key: 'az', label: 'Aim height', help: 'Where it points: height', match: /^(aim ?(z|height)|aim ?height ?\(.*\)|focus ?z|target ?z)$/i },
  { key: 'colour', label: 'Colour', help: 'A colour like #FFAA33', match: /^(colou?r|rgb|hex)$/i },
  { key: 'gel', label: 'Gel', help: 'Gel name or number, e.g. “L201”', match: /^(gel|filter|colou?r ?(filter|gel)|frame)$/i },
  { key: 'level', label: 'Brightness (%)', help: 'Intensity, 0–100', match: /^(brightness|level|intensity|dimmer|%|brightness ?\(%\))$/i },
  { key: 'beam', label: 'Beam angle (°)', help: 'Beam size in degrees', match: /^(beam|beam ?angle|beam ?\(°\)|field ?angle|degree|°)$/i },
  { key: 'purpose', label: 'Purpose', help: 'What it’s for: “DSL special”', match: /^(purpose|focus|note|notes|use|area)$/i },
];

export type Mapping = Partial<Record<FieldKey, number>>;

/** Match the file's column headings to our fields. */
export function guessMapping(head: string[]): Mapping {
  const m: Mapping = {};
  head.forEach((h, i) => {
    const f = FIELDS.find((x) => x.match.test(h.trim()) && m[x.key] === undefined);
    if (f) m[f.key] = i;
  });
  return m;
}

const RULES: [RegExp, FixtureType][] = [
  [/follow ?spot|followspot|super ?trouper|lycian|robert juliat (cyrano|lancelot|manon)/i, 'follow'],
  [/moving|mover|\bmac\b|robe|vari-?lite|\bvl\d|spiider|bmfl|megapointe|pointe|sharpy|clay paky|mythos|beam ?\d+|\bspot ?head|wash ?head|pan.?tilt/i, 'moving'],
  [/fresnel|\bpc\b|plano|pebble|cantata f|arri/i, 'fresnel'],
  [/source ?(4|four)|s4\b|ellipsoidal|\bers\b|leko|profile|zoom spot|\bspot\b|selecon|pacific|sl\d|\bcolorsource spot/i, 'profile'],
  [/cyc|batten|strip|ground ?row|colorforce|chroma-q (color )?force|\bbar\b|asymmetric|flood/i, 'cyc'],
  [/uplight|floor ?can|\bshin\b|footlight|boom base/i, 'uplight'],
  [/practical|lamp|chandelier|sconce|bulb/i, 'practical'],
  [/house ?light|houselight/i, 'house'],
  [/\bpar\b|par ?(56|64|38|16|can)|wash|led ?par|colorsource par|\bpar\d|parnel|parcan/i, 'par'],
];

/** What kind of light a name or model is. `known` is false when we're guessing (it becomes a stand-in). */
export function guessType(text: string | undefined): { type: FixtureType; known: boolean } {
  const t = (text ?? '').trim();
  if (!t) return { type: 'par', known: false };
  for (const [type, spec] of Object.entries(FIXTURES) as [FixtureType, (typeof FIXTURES)[FixtureType]][]) if (spec.label.toLowerCase() === t.toLowerCase()) return { type, known: true };
  for (const [re, type] of RULES) if (re.test(t)) return { type, known: true };
  return { type: 'par', known: false };
}

/** Common gel numbers (Lee “L…”, Rosco “R…”) and roughly what colour they give. */
const GEL_NUMBERS: Record<string, [string, string]> = {
  L201: ['Lee 201 Full CT Blue', '#c9dcff'],
  L202: ['Lee 202 Half CT Blue', '#dde8ff'],
  L203: ['Lee 203 Quarter CT Blue', '#eef3ff'],
  L204: ['Lee 204 Full CT Orange', '#ffc48a'],
  L205: ['Lee 205 Half CT Orange', '#ffd8ae'],
  L206: ['Lee 206 Quarter CT Orange', '#ffe8cf'],
  L106: ['Lee 106 Primary Red', '#e3202a'],
  L119: ['Lee 119 Dark Blue', '#1f3fbf'],
  L181: ['Lee 181 Congo Blue', '#2b1680'],
  L147: ['Lee 147 Apricot', '#ffb184'],
  L139: ['Lee 139 Primary Green', '#22a845'],
  R02: ['Rosco 02 Bastard Amber', '#fbc493'],
  R33: ['Rosco 33 No Color Pink', '#f8c6c8'],
  R60: ['Rosco 60 No Color Blue', '#bcd3f2'],
  R80: ['Rosco 80 Primary Blue', '#2c56d9'],
  R27: ['Rosco 27 Medium Red', '#c8102e'],
};

/** A colour from a hex or a gel name/number we know. */
function colourOf(colour?: string, gel?: string): { color?: string; gel?: string } {
  // A "Color" column often holds gel numbers (L201, R02): treat anything that isn't a hex colour as a gel.
  if (colour?.trim() && !/#?[0-9a-f]{6}\b/i.test(colour) && !gel?.trim()) return colourOf(undefined, colour);
  const hex = colour?.match(/#?([0-9a-f]{6})\b/i);
  const num = gel?.trim().toUpperCase().replace(/^(LEE|ROSCO|ROSCOLUX)\s*/, (m) => (m.startsWith('L') ? 'L' : 'R')).replace(/\s+/g, '').replace(/^R0*(\d)/, 'R$1');
  const known = num ? GEL_NUMBERS[num] ?? GEL_NUMBERS[num.replace(/^R(\d)$/, 'R0$1')] : undefined;
  if (known) return { color: known[1], gel: known[0] };
  const g = gel?.trim() ? GELS.find((x) => x.name.toLowerCase().startsWith(gel.trim().toLowerCase()) || gel.trim().toLowerCase().startsWith(x.name.toLowerCase())) : undefined;
  return { ...(hex ? { color: `#${hex[1].toLowerCase()}` } : g ? { color: g.color } : {}), ...(gel?.trim() ? { gel: g?.name ?? gel.trim() } : {}) };
}

const numberIn = (s: string | undefined) => {
  if (!s) return undefined;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
};

/** Turn spreadsheet rows into lights to place. */
export function rowsToLights(rows: string[][], m: Mapping, coords: CoordSystem): ImportLight[] {
  const get = (r: string[], k: FieldKey) => (m[k] !== undefined ? r[m[k]!] : undefined);
  const out: ImportLight[] = [];
  for (const r of rows) {
    if (!r.some((c) => c)) continue;
    const kindText = get(r, 'type') || undefined;
    const model = get(r, 'model') || undefined;
    // The model says most (and is what a stand-in stands in for); the kind column is the fallback.
    const fromModel = guessType(model);
    const fromKind = guessType(kindText ?? (model ? undefined : get(r, 'name')));
    const { type, known } = fromModel.known ? fromModel : fromKind.known ? fromKind : fromModel;
    const typeText = model ?? kindText;
    const xyz = [numberIn(get(r, 'x')), numberIn(get(r, 'y')), numberIn(get(r, 'z'))];
    const aim = [numberIn(get(r, 'ax')), numberIn(get(r, 'ay')), numberIn(get(r, 'az'))];
    const has = (v: (number | undefined)[]) => v.every((n) => n !== undefined);
    const levelText = get(r, 'level') ?? '';
    let level = numberIn(levelText);
    // 0–1 fractions (e.g. "0.75") are percentages too.
    if (level !== undefined && level > 0 && level <= 1 && levelText.includes('.') && !levelText.includes('%')) level *= 100;
    out.push({
      channel: numberIn(get(r, 'channel')),
      name: get(r, 'name') || typeText,
      typeText,
      type,
      known: known || !typeText,
      position: get(r, 'position') || undefined,
      unit: numberIn(get(r, 'unit')),
      ...(has(xyz) ? { pos: toWorld(xyz as [number, number, number], coords) } : {}),
      ...(has(xyz) && has(aim) ? { target: toWorld(aim as [number, number, number], coords) } : {}),
      ...colourOf(get(r, 'colour'), get(r, 'gel')),
      ...(level !== undefined ? { intensity: Math.min(100, Math.max(0, level)) } : {}),
      // No beam column: “Source Four 26deg” or “19°” in the model name.
      beam: numberIn(get(r, 'beam')) ?? numberIn(typeText?.match(/(\d{1,3})\s*(deg|°|degree)/i)?.[1]),
      purpose: get(r, 'purpose') || undefined,
    });
  }
  return out;
}

/** Remember how a file's columns were matched, so the same kind of file needs no matching next time. */
const MAP_KEY = 'stage-builder:import-mapping';
export function rememberMapping(head: string[], m: Mapping) {
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}');
    all[head.join('|').toLowerCase()] = m;
    localStorage.setItem(MAP_KEY, JSON.stringify(all));
  } catch {
    /* private mode: just don't remember */
  }
}
export function recalledMapping(head: string[]): Mapping | null {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}')[head.join('|').toLowerCase()] ?? null;
  } catch {
    return null;
  }
}
