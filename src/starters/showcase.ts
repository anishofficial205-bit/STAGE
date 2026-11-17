/**
 * Showcase templates: big, finished productions that use most of what the app
 * can do — screens with artwork, neon and bulb frames, haze and moving lights,
 * a cast placed on stage. Each is built with the same actions a user would use.
 * Positions are in world metres for the template sizes given here.
 */
import type { Params } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { addObjectAt, currentStage } from '../objects/actions';
import { SURFACE } from '../objects/ui';
import { assignGraphic } from '../graphics/library';
import { lightActions } from '../lighting/actions';
import { PRESET_LOOKS, fadeTo, lookActions } from '../lighting/looks';
import type { FixtureType, Fixture, Vec3 } from '../lighting/types';
import { blockingActions } from '../blocking/actions';
import type { Pt, Speed } from '../blocking/types';
import { useBlockingUI } from '../blocking/ui';
import { useLightsUI } from '../lighting/ui';
import { aimPoints } from '../lighting/follow';
import type { ArtKey } from './showcaseArt';

/** Graphic ids for the artwork a showcase asked for. */
export type ArtIds = Partial<Record<ArtKey, string>>;

export interface ShowcaseScene {
  id: string;
  title: string;
  blurb: string;
  image: string;
  templateId: string;
  /** A size from the template's list, then changes on top of it. */
  preset?: string;
  params?: Params;
  art: ArtKey[];
  build: (g: ArtIds) => void;
}

// --- Helpers -------------------------------------------------------------------

const state = () => useProjectStore.getState();
const objects = () => state().objectsByTemplate[state().templateId] ?? [];
const lighting = () => state().lightingByTemplate[state().templateId]!;

/** Add a piece at world (x, z), turned `rot` degrees and raised `elev`. Returns its id. */
function put(type: string, x: number, z: number, params: Params = {}, name?: string, rot = 0, elev?: number) {
  addObjectAt(type, [x, z]);
  const list = objects();
  const id = list[list.length - 1].id;
  const [cx, cz] = currentStage().info.centre;
  state().updateObjects((l) =>
    l.map((o) => (o.id === id ? { ...o, x: x - cx, z: z - cz, rotation: rot, ...(elev !== undefined ? { elevation: elev } : {}), name: name ?? o.name, params: { ...o.params, ...params } } : o)),
  );
  return id;
}

/** Paint every face of a piece one colour. */
function paint(id: string, color: string, roughness = 0.6) {
  state().updateObjects((l) => l.map((o) => (o.id === id ? { ...o, faces: { '*': { material: 'paint', color, roughness } } } : o)));
}

function show(target: { objectId: string; face: string }, graphic: string | undefined) {
  if (graphic) assignGraphic(target, graphic);
}

/** Add a light at a world position (on the floor, or hung where it is). */
function light(type: FixtureType, pos: Vec3, change: Partial<Fixture> = {}, floor = false) {
  const before = new Set(lighting().fixtures.map((f) => f.id));
  lightActions.addFixture(type, { pos, mount: floor ? 'floor' : null });
  const id = lighting().fixtures.find((f) => !before.has(f.id))?.id;
  if (id) lightActions.patch([id], change);
  return id;
}

/** Performers placed at world positions; `sitting` names sit down. */
function cast(list: [string, number, number][], sitting: string[] = []) {
  const ids = list.map(([name]) => {
    const p = blockingActions.addPerformer();
    blockingActions.patchPerformers([p.id], { name, ...(sitting.includes(name) ? { posture: 'sitting' as const } : {}) });
    return p.id;
  });
  blockingActions.setStart(ids, (_s, id) => {
    const [, x, z] = list[ids.indexOf(id)];
    return { x, z, onStage: true, entrance: undefined };
  });
  useBlockingUI.getState().select(null);
}

/** Keep the lights as built as the show's look, add a plain wash, and end on the show. */
function looks(showName: string) {
  const showLook = lookActions.save(showName);
  const wash = PRESET_LOOKS.find((p) => p.name === 'Full stage wash');
  if (wash) {
    fadeTo(wash.make(lighting().fixtures), 0);
    lookActions.save(wash.name);
  }
  fadeTo(showLook, 0);
  useLightsUI.getState().select(null);
}

/** Set groups of lights to a state, then keep it as a named look. */
function stateLook(name: string, groups: [(string | undefined)[], Partial<Fixture>][]) {
  for (const [ids, change] of groups) {
    const list = ids.filter((id): id is string => !!id);
    if (list.length) lightActions.patch(list, change);
  }
  return lookActions.save(name);
}

const ROW = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

// --- The shows -----------------------------------------------------------------

const stadium: ShowcaseScene = {
  id: 'stadium-tour',
  title: 'Stadium pop tour',
  blurb: 'A tiered round stage under an LED halo, clock-face screens, a runway loop to a B-stage, stands all round.',
  image: '/starters/stadium-tour.jpg',
  templateId: 'open-air',
  preset: 'Stadium',
  art: ['clock', 'halo'],
  build: (g) => {
    lightActions.ensureReady();
    put('round-platform', 0, -7, { diameter: 11, height: 0.4 }, 'Tier 1');
    put('round-platform', 0, -7, { diameter: 8, height: 0.8 }, 'Tier 2');
    put('round-platform', 0, -7, { diameter: 4.6, height: 1.3 }, 'Tier 3');
    const halo = put('led-ring', 0, -7, { diameter: 15, height: 3 }, 'Halo screen', 0, 10);
    show({ objectId: halo, face: 'screen' }, g.halo);
    put('arc-platform', 0, 5.3, { radius: 9, width: 2.4, angle: 180, height: 1.8, deckColor: '#e8e6f0', edgeLight: true, edgeColor: '#ff4fb3' }, 'Runway');
    put('round-platform', 0, 10.6, { diameter: 5, height: 1.8 }, 'B-stage');
    put('round-platform', 0, 10.6, { diameter: 3, height: 2.2 }, 'B-stage top');
    for (const face of ['left-screen', 'right-screen']) show({ objectId: SURFACE, face }, g.clock);

    const pal = ['#ff2d95', '#8a3dff', '#2ad4ff', '#ff2d95', '#ffb13d', '#8a3dff'];
    ROW(12, (i) => {
      const x = -13 + (i * 26) / 11;
      light('moving', [x, 1.85, -13.4], { color: pal[i % pal.length], intensity: 100, beam: 5, target: [x * 2.2, 40, -30] }, true);
    });
    ROW(10, (i) => {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * 6, z = -7 + Math.sin(a) * 6;
      light('moving', [x, 1.85, z], { color: i % 2 ? '#ffffff' : '#ff7ad1', intensity: 100, beam: 4, target: [x * 1.5, 30, z + Math.sin(a) * 6] }, true);
    });
    ROW(8, (i) => {
      const a = Math.PI * (i / 7);
      const x = Math.cos(a) * 10.5, z = Math.sin(a) * 10.5 + 1.3;
      light('moving', [x, 0.05, z], { color: i % 2 ? '#2ad4ff' : '#8a3dff', intensity: 100, beam: 4, target: [x * 1.3, 28, z + 7] }, true);
    });
    ROW(6, (i) => light('fresnel', [-12 + i * 4.8, 16, 4], { color: i % 2 ? '#ff9ad6' : '#b8a4ff', intensity: 80, target: [-8 + i * 3.2, 2, -7] }));
    for (const sx of [-1, 1]) light('follow', [sx * 14, 12, 30], { color: '#ffffff', intensity: 100, beam: 6, target: [sx * 0.6, 3.5, -7] });
    light('follow', [0, 14, 40], { color: '#fff3e0', intensity: 100, beam: 6, target: [0, 3, 10.6] });
    ROW(5, (i) => {
      const a = Math.PI * (0.1 + i * 0.2);
      light('fresnel', [Math.cos(a) * 16, 14, 0.8 + Math.sin(a) * 16], { color: i % 2 ? '#ffb3e6' : '#c7b8ff', intensity: 90, target: [Math.cos(a) * 9, 1.8, 0.8 + Math.sin(a) * 9] });
    });
    ROW(6, (i) => light('par', [-12 + i * 4.8, 1.85, -0.3], { color: '#ffd9f0', intensity: 30, beam: 40, target: [-18 + i * 7.2, 1, 25] }, true));
    lightActions.setHaze({ on: true, density: 80 });

    const dancers: [string, number, number][] = [['Star', 0, -7]];
    ROW(8, (i) => {
      const a = (i / 8) * Math.PI * 2;
      dancers.push([`Dancer ${i + 1}`, Math.cos(a) * 3.2, -7 + Math.sin(a) * 3.2]);
    });
    ROW(6, (i) => {
      const a = Math.PI * (0.12 + i * 0.152);
      dancers.push([`Dancer ${i + 9}`, Math.cos(a) * 9, 0.8 + Math.sin(a) * 9]);
    });
    dancers.push(['Guest', 0, 10.6]);
    cast(dancers);
    looks('Opening number');
  },
};

const arena: ShowcaseScene = {
  id: 'arena-rock',
  title: 'Arena rock',
  blurb: 'Six truss pods full of moving lights, a curved LED header, live-camera side screens and a band in haze.',
  image: '/starters/arena-rock.jpg',
  templateId: 'open-air',
  preset: 'Major festival',
  params: { timeOfDay: 'night', groundType: 'paved', background: 'open', platformWidth: 24, platformDepth: 12, platformHeight: 1.8, structure: 'none', towers: true, towerHeight: 11, screenWidth: 7, backdrop: false, audienceWidth: 70, audienceDepth: 50 },
  art: ['header', 'feed'],
  build: (g) => {
    lightActions.ensureReady();
    const header = put('led-ring', 0, -21, { diameter: 36, height: 2.4, arc: 80, trim: '#ffb070' }, 'Curved header', 0, 12.6);
    show({ objectId: header, face: 'screen' }, g.header);
    for (const face of ['left-screen', 'right-screen']) show({ objectId: SURFACE, face }, g.feed);
    put('drum-riser', 0, -9.4, {}, 'Drum riser');
    put('platform', -6, -9.6, { width: 4, depth: 2.4, heightPreset: 'custom', customHeight: 0.5 }, 'Keys riser');
    put('platform', 6, -9.6, { width: 4, depth: 2.4, heightPreset: 'custom', customHeight: 0.5 }, 'Bass riser');
    for (const x of [-10.2, -9, 9, 10.2]) paint(put('box', x, -11.2, { width: 1.1, depth: 0.5, height: 1.6 }, 'Amp stack'), '#18181c');
    for (const [x, n] of [[-4, 'Mic SR'], [0, 'Mic centre'], [4, 'Mic SL']] as const) put('mic-stand', x, -2.4, {}, n);

    const pods: [number, number, number][] = [[-8, -3.5, 10.2], [0, -2.5, 10.8], [8, -3.5, 10.2], [-8, -9.5, 9.4], [0, -9, 9.8], [8, -9.5, 9.4]];
    pods.forEach(([px, pz, h], k) => {
      const s = 2.8;
      const name = `Pod ${k + 1}`;
      put('truss', px, pz - s / 2, { length: s, mount: 'hanging' }, name, 0, h);
      put('truss', px, pz + s / 2, { length: s, mount: 'hanging' }, name, 0, h);
      put('truss', px - s / 2, pz, { length: s, mount: 'hanging' }, name, 90, h);
      put('truss', px + s / 2, pz, { length: s, mount: 'hanging' }, name, 90, h);
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4], [0, -1.4], [0, 1.4], [-1.4, 0], [1.4, 0]])
        light('moving', [px + dx, h - 0.4, pz + dz], { color: k < 3 ? '#ffffff' : '#ffc890', intensity: 100, beam: 3, target: [px + dx * 6, 1.8, pz + dz * 5 + (k < 3 ? 4 : 0)] });
    });
    ROW(8, (i) => light('fresnel', [-14 + i * 4, 12, 8], { color: i % 2 ? '#ff6a2a' : '#ffb070', intensity: 85, target: [-9 + i * 2.6, 2, -6] }));
    ROW(10, (i) => light('moving', [-10 + i * 2.2, 1.85, -0.4], { color: '#fff4e0', intensity: 100, beam: 3, target: [-30 + i * 6.6, 18, 40] }, true));
    ROW(8, (i) => light('moving', [-10.5 + i * 3, 1.85, -11.7], { color: '#ff7a2a', intensity: 100, beam: 3, target: [-25 + i * 7, 30, -30] }, true));
    lightActions.setHaze({ on: true, density: 85 });
    cast([['Vocals', 0, -2.8], ['Guitar', -4.5, -3.5], ['Bass', 4.5, -3.5], ['Drums', 0, -9.6], ['Keys', -6, -9.6]]);
    looks('Big chorus');
  },
};

const cabaret: ShowcaseScene = {
  id: 'cabaret',
  title: 'Cabaret musical',
  blurb: 'Red velvet and gold, a heart of bulbs round a neon title, chandeliers, a grand stair and a dance line.',
  image: '/starters/cabaret.jpg',
  templateId: 'proscenium',
  preset: 'City theatre',
  params: { rows: 18 },
  art: ['velvet', 'sunburst'],
  build: (g) => {
    lightActions.ensureReady();
    show({ objectId: SURFACE, face: 'arch-front' }, g.velvet);
    show({ objectId: put('backdrop', 0, -11.3, { width: 15, height: 9 }, 'Sunburst drop'), face: 'front' }, g.sunburst);
    put('main-curtain', 0, -0.9, { style: 'austrian', open: 100, color: '#8a0f1f', width: 13, height: 8.6 }, 'House curtain');
    put('bulb-frame', 0, -3.2, { shape: 'heart', width: 8.6, height: 6.6, frame: 0.22, spacing: 0.32, bulbColor: '#ffd890', frameColor: '#b01030' }, 'Heart marquee');
    put('neon-sign', 0, -3.0, { shape: 'text', text: 'Le Cabaret', font: 'script', color: '#ff3d8b', height: 1.9, backing: false }, 'Title sign', 0, 4.7);
    put('staircase', 0, -8.2, { width: 3.4, steps: 9, totalHeight: 1.6, railing: true }, 'Centre stair');
    put('platform', 0, -10.2, { width: 9, depth: 2.4, heightPreset: 'custom', customHeight: 1.6 }, 'Upper deck');
    for (const sx of [-1, 1]) {
      put('column', sx * 5.4, -9.6, { diameter: 0.45, height: 5.5 }, 'Column');
      put('sofa', sx * 3.8, -4.6, {}, 'Chaise', sx * -25);
      put('table', sx * 3.6, 0.9, { shape: 'round', diameter: 0.7, height: 0.75 }, 'Bistro table');
      put('chair', sx * 4.4, 1.3, {}, 'Bistro chair', sx * -60);
      put('chandelier', sx * 4, -5.5, { diameter: 1.2, tiers: 2 }, 'Stage chandelier', 0, 6.4);
    }
    for (const z of [6, 13]) put('chandelier', 0, z, { diameter: 2.2, tiers: 3 }, 'House chandelier', 0, 9.5);

    ROW(7, (i) => light('fresnel', [-9 + i * 3, 9.5, 6], { color: i % 2 ? '#ff2a5a' : '#ff8fb0', intensity: 80, target: [-6 + i * 2, 1.5, -5] }));
    ROW(6, (i) => light('fresnel', [-7.5 + i * 3, 8.5, -5], { color: '#ff3a3a', intensity: 70, target: [-7.5 + i * 3, 1, -9] }));
    ROW(8, (i) => light('moving', [-8 + i * 2.3, 8.8, -2], { color: i % 2 ? '#ff4f8b' : '#ffd890', intensity: 100, beam: 6, target: [-6 + i * 1.7, 1, -6 + (i % 2) * 3] }));
    for (const sx of [-1, 1]) light('follow', [sx * 4, 9, 22], { color: '#fff4e0', intensity: 100, beam: 5, target: [sx * 0.9, 2.6, -4.8] });
    ROW(5, (i) => light('cyc', [-6 + i * 3, 9, -10], { color: i % 2 ? '#ff2a4a' : '#ffb060', intensity: 90, target: [-6 + i * 3, 4, -11.3] }));
    lightActions.setHaze({ on: true, density: 35 });
    cast([
      ['Star', 0, -4.8],
      ['Emcee', 0, -10.2],
      ...ROW(8, (i): [string, number, number] => [`Dancer ${i + 1}`, -6.3 + i * 1.8, -2.2 + (i % 2) * 0.6]),
      ['Patron 1', -3.6, 1.6],
      ['Patron 2', 3.6, 1.6],
    ]);
    looks('Finale');
  },
};

const sea: ShowcaseScene = {
  id: 'sea-musical',
  title: 'Family sea musical',
  blurb: 'Bright scaffold arches, ladders to lookouts, neon stars and waves, an underwater backdrop and a colourful cast.',
  image: '/starters/sea-musical.jpg',
  templateId: 'proscenium',
  preset: 'City theatre',
  params: { rows: 18, balcony: false, pit: false },
  art: ['sea', 'stripes'],
  build: (g) => {
    lightActions.ensureReady();
    show({ objectId: SURFACE, face: 'arch-front' }, g.stripes);
    show({ objectId: put('cyclorama', 0, -11, { width: 16, height: 9, curveRadius: 1.5 }, 'Sea cyc'), face: 'front' }, g.sea);
    const bar = (x: number, z: number, w: number, d: number, h: number, e: number, c: string) => paint(put('box', x, z, { width: w, depth: d, height: h }, 'Scaffold', 0, e), c, 0.45);
    const scaffold = (z: number, W: number, H: number, c1: string, c2: string) => {
      for (const sx of [-1, 1]) for (const dz of [-0.35, 0.35]) bar((sx * W) / 2, z + dz, 0.14, 0.14, H, 0, c1);
      for (const dz of [-0.35, 0.35]) bar(0, z + dz, W + 0.14, 0.14, 0.14, H - 0.14, c1);
      for (let k = 1; k < 5; k++) for (const sx of [-1, 1]) bar((sx * W) / 2, z, 0.1, 0.84, 0.1, (k * H) / 5, c2);
      for (let k = 0; k < 6; k++) bar(-W / 2 + ((k + 0.5) * W) / 6, z, 0.1, 0.84, 0.1, H - 0.6, c2);
    };
    scaffold(-3.2, 11, 6.8, '#ff3d9a', '#ffd23f');
    scaffold(-6.8, 9, 5.4, '#3dc1ff', '#3dffb0');
    for (const sx of [-1, 1]) {
      paint(put('platform', sx * 4.4, -8.4, { width: 3.2, depth: 2.6, heightPreset: 'custom', customHeight: 2.6 }, 'Lookout'), sx < 0 ? '#3dffb0' : '#ff8a3d');
      put('ladder', sx * 2.6, -7.4, { height: 2.8, color: sx < 0 ? '#ffd23f' : '#3dc1ff' }, 'Ladder', sx * -90);
      paint(put('platform', sx * 5.4, -4.8, { width: 1.6, depth: 1.6, heightPreset: 'custom', customHeight: 1.3 }, 'Rock'), '#9f7aff');
    }
    paint(put('platform', 0, -9.8, { width: 5, depth: 2, heightPreset: 'custom', customHeight: 1.2 }, 'Centre deck'), '#ff5fa8');
    put('steps', 0, -8.3, { width: 2.4, steps: 4, totalHeight: 1.2, stepDepth: 0.3 }, 'Deck steps');
    const neon: [string, string, number, number, number][] = [['star', '#ffd23f', -3.6, 6.2, 2.2], ['flower', '#ff5fa8', 3.6, 6.1, 2.2], ['wave', '#3dffb0', -1.8, 7.1, 1.7], ['spiral', '#3dc1ff', 1.8, 7.1, 1.7], ['circle', '#ff8a3d', 0, 7.4, 1.2]];
    for (const [shape, color, x, e, height] of neon) put('neon-sign', x, -3.0, { shape, color, height, backing: false }, `Neon ${shape}`, 0, e);
    ROW(6, (i) => put('neon-sign', -5.5 + i * 2.2, -0.2, { shape: ['star', 'flower', 'circle'][i % 3], color: ['#ffd23f', '#ff5fa8', '#3dffb0'][i % 3], height: 0.7, backing: false }, 'Footlight shape', 0, 1.02));

    ROW(7, (i) => light('fresnel', [(-9 + i * 3) * 0.65, 9.5, 5], { color: ['#fff2c0', '#ffd0f0', '#d0f6ff'][i % 3], intensity: 95, beam: 26, target: [-5.4 + i * 1.8, 1.2, -2.8] }));
    ROW(5, (i) => light('cyc', [-6 + i * 3, 9, -9.5], { color: '#7fd8ff', intensity: 100, target: [-6 + i * 3, 4, -11] }));
    ROW(8, (i) => light('moving', [-7 + i * 2, 8.6, -2], { color: ['#ff5fa8', '#ffd23f', '#3dffb0', '#3dc1ff'][i % 4], intensity: 100, beam: 8, target: [-6 + i * 1.7, 1, -6 + (i % 2) * 3] }));
    lightActions.setHaze({ on: true, density: 25 });
    const names = ['Sponge', 'Star', 'Squid', 'Crab', 'Squirrel', 'Snail', 'Plankton', 'Whale'];
    cast([
      ...names.map((n, i): [string, number, number] => [n, -5.6 + i * 1.6, -1.5 - (i % 2) * 0.8]),
      ['Lookout 1', -4.4, -8.4],
      ['Lookout 2', 4.4, -8.4],
      ['Chorus 1', -1.2, -9.8],
      ['Chorus 2', 1.2, -9.8],
    ]);
    looks('Under the sea');
  },
};

const drawingRoom: ShowcaseScene = {
  id: 'drawing-room',
  title: 'Drawing-room drama',
  blurb: 'A country-house mystery: a gallery and grand stair, a fire in the grate, a storm at the windows and four lighting looks.',
  image: '/starters/drawing-room.jpg',
  templateId: 'proscenium',
  preset: 'City theatre',
  // The arch stops just under the top of the set walls, and black borders mask the rest.
  params: { rows: 18, balcony: false, pit: false, archHeight: 6.4 },
  art: ['damask', 'rug', 'landscape', 'sky', 'clock'],
  build: (g) => {
    lightActions.ensureReady();
    const wood = '#3a2214';
    // Back wall: two upper doors onto the gallery, the hall door below
    const back = (x: number, type: string, p: Params) => show({ objectId: put(type, x, -8.6, { ...p, height: 6.8, brace: false }, 'Back wall'), face: 'front' }, g.damask);
    back(-4.8, 'flat', { width: 2.4 });
    back(-2.4, 'flat-opening', { width: 2.4, openingType: 'window', openingWidth: 1.2, openingHeight: 2.3, openingOffset: 2.75 });
    back(0, 'flat-opening', { width: 2.4, openingType: 'door', openingWidth: 1.7, openingHeight: 2.4 });
    back(2.4, 'flat-opening', { width: 2.4, openingType: 'window', openingWidth: 1.2, openingHeight: 2.3, openingOffset: 2.75 });
    back(4.8, 'flat', { width: 2.4 });
    paint(put('flat', 0, -9.3, { width: 9.6, height: 6.8, brace: false }, 'Hall backing'), '#1c1410', 0.9);
    put('chandelier', 0, -8.95, { diameter: 0.9, tiers: 1 }, 'Hall lantern', 0, 5.6);
    // The gallery landing with its balustrade, and the grand stair up to it
    paint(put('platform', 0, -7.75, { width: 9.6, depth: 1.6, heightPreset: 'custom', customHeight: 2.6 }, 'Gallery'), '#5a3826');
    paint(put('box', 0, -6.98, { width: 9.6, depth: 0.1, height: 0.09 }, 'Gallery rail', 0, 3.5), wood);
    ROW(23, (i) => paint(put('box', -4.4 + i * 0.4, -6.98, { width: 0.05, depth: 0.05, height: 0.9 }, 'Baluster', 0, 2.6), '#c9a25a'));
    put('staircase', 3.9, -5.2, { kind: 'curved', width: 1.5, steps: 14, totalHeight: 2.6, railing: true }, 'Grand stair');
    // Stage right: the fireplace wall. Stage left: French windows onto the storm.
    const sr = put('wall-run', -6.9, -5.6, { panels: 2, panelWidth: 2.6, height: 6.8 }, 'Wall SR', 72);
    for (const face of ['panel-1-front', 'panel-2-front']) show({ objectId: sr, face }, g.damask);
    paint(put('box', -5.9, -4.6, { width: 2.2, depth: 0.45, height: 1.5 }, 'Fireplace', 72), '#e6dccb', 0.3);
    paint(put('box', -5.72, -4.54, { width: 1.0, depth: 0.2, height: 0.9 }, 'Firebox', 72), '#140c08');
    paint(put('box', -5.92, -4.6, { width: 2.6, depth: 0.55, height: 0.1 }, 'Mantel', 72, 1.5), '#e6dccb', 0.3);
    show({ objectId: put('picture-frame', -6.05, -4.66, { width: 1.2, height: 1.5, hangHeight: 2.0 }, 'Portrait of the late Lord', 72), face: 'picture' }, g.landscape);
    show({ objectId: put('flat-opening', 6.9, -5.6, { width: 5.2, height: 6.8, openingType: 'door', openingWidth: 2.6, openingHeight: 3.2, brace: false }, 'French windows', -72), face: 'front' }, g.damask);
    show({ objectId: put('backdrop', 9.4, -6.4, { width: 7, height: 6 }, 'Storm sky', -72), face: 'front' }, g.sky);
    // The room
    show({ objectId: put('floor-decal', 0, -3.4, { width: 6, depth: 3.8 }, 'Rug'), face: 'graphic' }, g.rug);
    paint(put('sofa', -0.6, -4.9, {}, 'Chesterfield'), '#5a141a');
    paint(put('chair', -3.0, -2.9, { style: 'armchair' }, 'Armchair', 60), '#2b4434');
    paint(put('chair', 2.6, -4.2, { style: 'armchair' }, 'Armchair', -40), '#2b4434');
    paint(put('table', -0.6, -3.6, { shape: 'rect', width: 1.2, depth: 0.6, height: 0.45 }, 'Coffee table'), wood);
    paint(put('table', -4.4, -6.6, { shape: 'rect', width: 1.5, depth: 0.7, height: 0.76 }, 'Writing desk', 30), wood);
    paint(put('box', -2.2, -8.2, { width: 0.55, depth: 0.4, height: 2.2 }, 'Grandfather clock'), wood, 0.35);
    show({ objectId: put('picture-frame', -2.2, -7.98, { width: 0.42, height: 0.42, hangHeight: 1.55 }, 'Clock face'), face: 'picture' }, g.clock);
    put('bookshelf', -6.4, -7.4, { width: 1.4, height: 2.6 }, 'Bookshelf', 72);
    put('plant', -5.6, -0.9, { height: 1.6 }, 'Palm');
    put('chandelier', 0, -3.6, { diameter: 1.6, tiers: 2 }, 'Chandelier', 0, 5.2);
    for (const [z, hang] of [[-2.2, 6.3], [-5.6, 6.6]]) paint(put('hanging-panel', 0, z, { width: 15, height: 3.2, thickness: 0.05, hangHeight: hang }, 'Border'), '#0b0908', 0.95);

    // The cast: Sir Hugo lies dead on the rug
    cast(
      [['Lady Ashford', -1.4, -7.7], ['Inspector', 3.0, -1.6], ['Colonel', -3.0, -2.9], ['Maid', 1.3, -6.2], ['Nephew', 5.2, -4.6], ['Sir Hugo', 0.8, -2.4]],
      ['Colonel'],
    );
    const people = state().blockingByTemplate[state().templateId]?.performers ?? [];
    const hugo = people.find((p) => p.name === 'Sir Hugo');
    if (hugo) blockingActions.patchPerformers([hugo.id], { posture: 'lying' });
    // The scene already moves: press play. The maid finds the body, the inspector closes in,
    // Lady Ashford crosses the gallery to the stair, the nephew comes in from the garden.
    const who = (name: string) => people.find((p) => p.name === name)?.id;
    const moves: [string, Pt[], number, Speed][] = [
      ['Maid', [[1.3, -6.2], [1.2, -4.6], [0.2, -3.3]], 0.5, 'fast'],
      ['Inspector', [[3.0, -1.6], [2.1, -2.0]], 1.5, 'normal'],
      ['Lady Ashford', [[-1.4, -7.7], [2.4, -7.7]], 3, 'slow'],
      ['Nephew', [[5.2, -4.6], [3.8, -3.3], [2.6, -1.1]], 5, 'normal'],
      ['Inspector', [[2.1, -2.0], [0.4, -1.1], [-2.2, -1.3], [-4.3, -3.1]], 8, 'slow'],
    ];
    for (const [name, points, start, speed] of moves) {
      const id = who(name);
      if (!id) continue;
      const path = blockingActions.addPath(id, points, undefined, start);
      blockingActions.patchPath(path.id, { speed });
    }
    useBlockingUI.getState().select(null);
    useBlockingUI.getState().setTime(0);

    // Lights. The fast 3D view draws 8 lights for real (the brightest ones), so each look is
    // carried by a few broad warm washes that reach the walls as well as the cast:
    // front washes from the house, two over the gallery and back wall, one on the fireplace wall, and the fire.
    const warm = '#ffbf78';
    const front = [-5.4, -1.8, 1.8, 5.4].map((x) => light('fresnel', [x, 9.5, 5], { color: warm, intensity: 100, beam: 46, target: [x * 0.9, 2.0, -5.5] }));
    const upstage = [-2.6, 2.6].map((x) => light('fresnel', [x, 9, -3.5], { color: '#ffb46a', intensity: 95, beam: 48, target: [x, 4.2, -8.6] }));
    const side = light('fresnel', [-1, 9, -1], { color: '#ffb070', intensity: 92, beam: 44, target: [-6.4, 2.8, -5.2], name: 'Fireplace wall' });
    const fire = light('practical', [-5.72, 0.35, -4.4], { color: '#ff7a2a', intensity: 90, name: 'Fire' }, true);
    const lamps = [[-4.4, 1.0, -6.6], [-1.6, 0.9, -3.6]].map(([x, y, z]) => light('practical', [x, y, z], { color: '#ff9a48', intensity: 70 }, true));
    const moon = light('profile', [11, 6, -5.2], { color: '#8fb4ff', intensity: 60, beam: 30, gobo: 'window', target: [0.8, 0, -3] });
    const sky = ROW(2, (i) => light('cyc', [7.8, 6, -3 - i * 3], { color: '#4a6ad8', intensity: 60, target: [9.4, 3, -6.4] }));
    const lightning = ROW(2, (i) => light('moving', [5 + i * 2, 9, -2], { color: '#eef3ff', intensity: 0, beam: 10, target: [2 - i * 3, 0, -3] }));
    // A soft light following each performer (their pool moves with them as the scene plays).
    const aims = aimPoints(0);
    const keys = people.filter((p) => p.id !== hugo?.id).map((p) => {
      const at = aims.get(p.id) ?? [0, 1.5, -4];
      if (at[2] < -6.9) return light('fresnel', [0.5, 7.5, 2.5], { color: '#ffd9a8', intensity: 60, beam: 34, target: [0.5, 3.9, at[2]], name: `Wash on ${p.name}`, purpose: p.name });
      return light('fresnel', [at[0] * 0.6, 9, Math.min(4, at[2] + 6)], { color: '#ffd9a8', intensity: 60, beam: 14, target: at, follow: p.id, name: `Wash on ${p.name}`, purpose: p.name });
    });
    const torch = light('profile', [0, 9, 10], { color: '#fff4e0', intensity: 0, beam: 7, target: hugo ? (aims.get(hugo.id) ?? [0.8, 0, -2.4]) : [0.8, 0, -2.4], follow: hugo?.id, name: 'The torch' });
    lightActions.setHaze({ on: true, density: 18 });

    const evening = stateLook('Evening, lamps lit', [[front, { intensity: 100, color: warm }], [upstage, { intensity: 95, color: '#ffb46a' }], [[side], { intensity: 92 }], [[fire], { intensity: 90 }], [lamps, { intensity: 70 }], [[moon], { intensity: 40 }], [sky, { intensity: 50 }], [lightning, { intensity: 0 }], [keys, { intensity: 60 }], [[torch], { intensity: 0 }]]);
    stateLook('The storm breaks', [[front, { intensity: 75, color: '#ffae66' }], [upstage, { intensity: 45 }], [[side], { intensity: 40 }], [[fire], { intensity: 90 }], [lamps, { intensity: 50 }], [[moon], { intensity: 100 }], [sky, { intensity: 70, color: '#3a5ad8' }], [lightning, { intensity: 100 }], [keys, { intensity: 40 }], [[torch], { intensity: 0 }]]);
    stateLook('Blackout, one torch', [[front, { intensity: 40, color: '#ff9e55' }], [upstage, { intensity: 20 }], [[side], { intensity: 15 }], [[fire], { intensity: 70 }], [lamps, { intensity: 0 }], [[moon], { intensity: 30 }], [sky, { intensity: 20 }], [lightning, { intensity: 0 }], [keys, { intensity: 0 }], [[torch], { intensity: 100 }]]);
    stateLook('The accusation', [[front, { intensity: 80, color: warm }], [upstage, { intensity: 100, color: '#ffc488' }], [[side], { intensity: 60 }], [[fire], { intensity: 85 }], [lamps, { intensity: 60 }], [[moon], { intensity: 40 }], [sky, { intensity: 40 }], [lightning, { intensity: 0 }], [keys, { intensity: 50 }], [[torch], { intensity: 55 }]]);
    const wash2 = PRESET_LOOKS.find((p) => p.name === 'Full stage wash');
    if (wash2) {
      fadeTo(wash2.make(lighting().fixtures), 0);
      lookActions.save(wash2.name);
    }
    fadeTo(evening, 0);
    useLightsUI.getState().select(null);
    // Open with everything at full strength, so set, lights and cast read together in every mode.
    state().setOtherLayers('show');
    state().saveView({ id: 'dress-circle', label: 'Dress circle', position: [3.2, 4.4, 11.5], target: [0, 2.0, -5] });
  },
};

const farce: ShowcaseScene = {
  id: 'farce',
  title: 'Farce comedy',
  blurb: 'Pink walls with six coloured doors on two levels, a staircase up to a gallery and bright comedy light.',
  image: '/starters/farce.jpg',
  templateId: 'proscenium',
  preset: 'City theatre',
  params: { rows: 18, balcony: false, pit: false },
  art: ['sky'],
  build: (g) => {
    lightActions.ensureReady();
    show({ objectId: put('cyclorama', 0, -11.4, { width: 18, height: 9 }, 'Sky cyc'), face: 'front' }, g.sky);
    const PINK = '#f2a0c0';
    const doors = ['#c43a6a', '#2f6ac4', '#e8b830', '#3ab08a', '#8a4ac4', '#e86a30'];
    let n = 0;
    const door = (x: number, z: number, elev: number, angle: number) => paint(put('door-frame', x, z, { width: 1.1, height: 2.2, doorPanel: true, doorAngle: angle }, `Door ${n + 1}`, 0, elev), doors[n++ % doors.length]);
    for (const [x, kind] of [[-3.3, 'door'], [-1.1, 'flat'], [1.1, 'door'], [3.3, 'flat'], [5.5, 'door']] as const) {
      const p = { width: 2.2, height: 3, brace: false };
      paint(kind === 'door' ? put('flat-opening', x, -8, { ...p, openingType: 'door', openingWidth: 1.1, openingHeight: 2.2 }, 'Lower wall') : put('flat', x, -8, p, 'Lower wall'), PINK, 0.7);
      if (kind === 'door') door(x, -7.98, 0, n % 2 ? 0 : 35);
    }
    paint(put('platform', 0.8, -9.2, { width: 12.4, depth: 2.4, heightPreset: 'custom', customHeight: 3 }, 'Gallery'), '#d9839f', 0.7);
    paint(put('box', 0.8, -8.1, { width: 12.4, depth: 0.08, height: 0.9 }, 'Gallery rail', 0, 3), '#ffffff', 0.4);
    for (const [x, kind] of [[-4.4, 'door'], [-2.2, 'flat'], [0, 'door'], [2.2, 'window'], [4.4, 'door'], [6.6, 'flat']] as const) {
      const p = { width: 2.2, height: 3.2, brace: false };
      const id =
        kind === 'flat'
          ? put('flat', x, -10.3, p, 'Upper wall', 0, 3)
          : put('flat-opening', x, -10.3, { ...p, openingType: kind, openingWidth: kind === 'door' ? 1.1 : 1.4, openingHeight: kind === 'door' ? 2.2 : 1.4, openingOffset: 1 }, 'Upper wall', 0, 3);
      paint(id, PINK, 0.7);
      if (kind === 'door') door(x, -10.28, 3, n % 2 ? 0 : 30);
    }
    paint(put('staircase', -5.4, -5.6, { width: 1.4, steps: 15, totalHeight: 3, railing: true }, 'Staircase'), '#ffffff', 0.5);
    for (const sx of [-1, 1]) paint(put('wall-run', sx * 7.2, -4.8, { panels: 2, panelWidth: 2.4, height: 6.2 }, 'Side wall', sx * -80), PINK, 0.7);
    paint(put('sofa', 1.2, -4.4, {}, 'Sofa'), '#2fa8a0');
    paint(put('chair', 4.4, -3.4, { style: 'armchair' }, 'Armchair', -40), '#e8b830');
    paint(put('table', -2.2, -3.4, { shape: 'rect', width: 0.8, depth: 0.5, height: 0.8 }, 'Drinks trolley'), '#c0c0c8', 0.3);
    put('table', 1.2, -3.2, { shape: 'round', diameter: 0.8, height: 0.45 }, 'Coffee table');
    put('plant', -3.8, -7.4, { height: 1.4 });
    put('plant', 6.2, -7.4, { height: 1.4 });
    put('picture-frame', -1.1, -7.95, { width: 1.2, height: 0.9, hangHeight: 1.6 }, 'Picture');
    put('picture-frame', 3.3, -7.95, { width: 1, height: 1.2, hangHeight: 1.5 }, 'Picture');
    put('chandelier', 1, -4, { diameter: 1.4, tiers: 2 }, 'Chandelier', 0, 6.4);

    ROW(6, (i) => light('fresnel', [-4.2 + i * 1.7, 9.5, 4], { color: '#fff1dc', intensity: 100, beam: 34, target: [-5 + i * 2.2, 1.6, -6.5] }));
    ROW(4, (i) => light('fresnel', [-4.5 + i * 3, 9.5, 2], { color: '#ffe4f0', intensity: 100, beam: 30, target: [-4.5 + i * 3, 4.5, -10] }));
    ROW(5, (i) => light('cyc', [-6 + i * 3, 9.5, -10.8], { color: '#9fd0ff', intensity: 100, target: [-6 + i * 3, 5, -11.4] }));
    cast([['Husband', -1.2, -2.4], ['Wife', 1.2, -4.4], ['Lover', 5.5, -7.4], ['Butler', -2.2, -3.0], ['Aunt', 0, -9.4], ['Plumber', -5.4, -6.4]]);
    looks('Doors slamming');
  },
};

const keynote: ShowcaseScene = {
  id: 'keynote',
  title: 'Tech keynote',
  blurb: 'A wide centre screen with tall side screens, red banners and uplights, a lectern in a follow spot, steps both sides.',
  image: '/starters/keynote.jpg',
  templateId: 'end-stage',
  preset: 'Auditorium',
  params: { stageWidth: 22, stageDepth: 8, stageHeight: 1.1, backWallHeight: 10, roomWidth: 32, roomLength: 34 },
  art: ['keynote', 'keynoteSide', 'banner'],
  build: (g) => {
    lightActions.ensureReady();
    const [, cz] = currentStage().info.centre;
    const zb = cz - 3.6;
    show({ objectId: put('led-wall', 0, zb, { panelsWide: 22, panelsHigh: 12, panelSize: 0.5 }, 'Main screen', 0, 1.4), face: 'screen' }, g.keynote);
    for (const sx of [-1, 1]) {
      show({ objectId: put('led-wall', sx * 9.2, zb + 0.4, { panelsWide: 8, panelsHigh: 12, panelSize: 0.5 }, 'Side screen', sx * -12, 1.4), face: 'screen' }, g.keynoteSide);
      for (const k of [0, 1]) show({ objectId: put('banner', sx * (6.3 + k * 5.8), zb + 0.2, { width: 1.1, height: 5.4, doubleSided: false }, 'Banner', 0, 1.6), face: 'front' }, g.banner);
      put('steps', sx * 9.6, cz + 4.6, { width: 1.6, steps: 4, totalHeight: 1.1, stepDepth: 0.32 }, 'Steps');
      put('speaker', sx * 12.2, cz + 3, {}, 'PA', sx * -18, 0);
      put('speaker', sx * 12.2, cz + 3, {}, 'PA', sx * -18, 0.9);
    }
    paint(put('lectern', 5.6, cz + 1.6, { width: 0.7 }, 'Lectern', -15), '#e8e8ee', 0.3);
    ROW(7, (i) => light('uplight', [-10.4 + i * 3.2, 1.15, zb + 0.35], { color: '#ff2a3a', intensity: 100, target: [-10.4 + i * 3.2, 9, zb] }, true));
    ROW(6, (i) => light('fresnel', [-7.5 + i * 3, 9, cz + 9], { color: '#f4f6ff', intensity: 90, beam: 24, target: [-7 + i * 2.8, 2, cz + 1] }));
    light('profile', [5.6, 9, cz + 14], { color: '#ffffff', intensity: 100, beam: 9, target: [5.6, 2.7, cz + 1.6] });
    lightActions.setHaze({ on: true, density: 25 });
    cast([['Presenter', 5.2, cz + 2.2]]);
    looks('Keynote');
  },
};

/** Give performers moves: each walks `points` starting at `start` seconds, holding where asked. */
function walks(list: [name: string, points: Pt[], start: number, speed: Speed, stops?: { index: number; hold: number }[]][]) {
  const people = state().blockingByTemplate[state().templateId]?.performers ?? [];
  for (const [name, points, start, speed, stops] of list) {
    const id = people.find((p) => p.name === name)?.id;
    if (!id) continue;
    const path = blockingActions.addPath(id, points, undefined, start);
    blockingActions.patchPath(path.id, { speed, ...(stops ? { stops } : {}) });
  }
  useBlockingUI.getState().select(null);
  useBlockingUI.getState().setTime(0);
}

// The runway (Traverse, 'Fashion show' size) runs along z from the entrance wall at -12.5 to +12.5.
const RZ = 12.5;

const noir: ShowcaseScene = {
  id: 'noir-fashion',
  title: 'Noir fashion show',
  blurb: 'A black runway edged in magenta light, a big screen and neon title at the entrance, beams down both sides and models walking in haze.',
  image: '/starters/noir.jpg',
  templateId: 'traverse',
  preset: 'Fashion show',
  params: { rows1: 4, rows2: 4 },
  art: ['halo', 'header'],
  build: (g) => {
    lightActions.ensureReady();
    show({ objectId: SURFACE, face: 'end-wall-a' }, g.halo);
    for (const s of [-1, 1]) paint(put('box', s * 1.5, 0, { width: 0.06, depth: 25, height: 0.04 }, 'LED edge', 0, 0.6), '#ff2bd6', 0.1);
    show({ objectId: put('led-wall', 0, -RZ + 0.4, { panelsWide: 12, panelsHigh: 7, panelSize: 0.5 }, 'Screen'), face: 'screen' }, g.header);
    put('neon-sign', 0, -RZ + 0.5, { shape: 'text', text: 'NOIR', font: 'block', color: '#ff2bd6', height: 1.1, backing: false }, 'Title', 0, 4.1);
    ROW(8, (i) => [-1, 1].forEach((s) => light('uplight', [s * 1.8, 0.6, -10 + i * 3], { color: i % 2 ? '#ff2bd6' : '#7a5cff', intensity: 80, beam: 6, target: [s * 2.4, 10, -10 + i * 3] }, true)));
    ROW(8, (i) => light('moving', [(i % 2 ? 1 : -1) * 1.8, 6, -11 + i * 3.2], { color: i % 2 ? '#ff2bd6' : '#ffffff', intensity: 100, beam: 4, target: [(i % 2 ? -1 : 1) * 3, 0.6, -9 + i * 3.2] }));
    // Six soft white pools cover the whole walk, so the models stay lit all the way down and back.
    ROW(6, (i) => light('fresnel', [0, 6, -10.5 + i * 4.3], { color: '#f0e8ff', intensity: 100, beam: 52, target: [0, 1.2, -10.5 + i * 4.3] }));
    light('follow', [0, 7, RZ + 8], { color: '#ffffff', intensity: 100, beam: 6, target: [0, 1.8, 4] });
    lightActions.setHaze({ on: true, density: 60 });
    // Three models already out on the runway; three more wait backstage behind the entrance.
    cast([
      ['Model 1', -0.45, 6], ['Model 2', -0.45, 0], ['Model 3', -0.45, -6],
      ['Model 4', 0, -13.4], ['Model 5', 0, -14.2], ['Model 6', 0, -15],
    ]);
    // Down the left of the walk, pose at the end, back up the right and off through the entrance.
    const lap = (from: Pt): Pt[] => [from, [-0.45, 10.6], [0.45, 10.6], [0.45, -12], [0.45, -13.6]];
    walks([
      ['Model 1', lap([-0.45, 6]), 0, 'normal', [{ index: 1, hold: 2 }]],
      ['Model 2', lap([-0.45, 0]), 1.5, 'normal', [{ index: 1, hold: 2 }]],
      ['Model 3', lap([-0.45, -6]), 3, 'normal', [{ index: 1, hold: 2 }]],
      ['Model 4', [[0, -13.4], [-0.45, -12], [-0.45, 10.6], [0.45, 10.6], [0.45, -12]], 5, 'normal', [{ index: 2, hold: 2 }]],
      ['Model 5', [[0, -14.2], [-0.45, -12], [-0.45, 10.6], [0.45, 10.6], [0.45, -12]], 8.5, 'normal', [{ index: 2, hold: 2 }]],
      ['Model 6', [[0, -15], [-0.45, -12], [-0.45, 10.6]], 12, 'normal', [{ index: 2, hold: 3 }]],
    ]);
    looks('Night show');
    state().setOtherLayers('show');
  },
};

const jazz: ShowcaseScene = {
  id: 'jazz-club',
  title: 'Jazz supper club',
  blurb: 'A grand piano and singer in the round, 24 lamp-lit supper tables on red velvet, amber light and a waiter doing the rounds.',
  image: '/starters/jazz.jpg',
  templateId: 'in-the-round',
  preset: 'Studio in-the-round',
  params: { shape: 'circle', stageSize: 13, stageHeight: 0.3, sections: 6, rows: 8, rake: 0.25, gap: 1.5, aisleWidth: 1.6, vomitories: true, lightingGrid: true, gridHeight: 11 },
  art: ['velvet'],
  build: (g) => {
    lightActions.ensureReady();
    show({ objectId: SURFACE, face: 'stage-floor' }, g.velvet);
    put('arc-platform', 0, 0, { radius: 2.6, width: 0.3, angle: 330, height: 0.45, deckColor: '#1a120c', edgeLight: true, edgeColor: '#ffb35c' }, 'Bandstand rim', 15);
    paint(put('box', -0.6, -0.5, { width: 1.6, depth: 1.1, height: 1.0 }, 'Grand piano', 20), '#0c0a09', 0.15);
    put('mic-stand', 0.9, 0.6, {}, 'Singer mic');
    paint(put('stool', -0.4, 0.4, {}, 'Piano stool'), '#0c0a09');
    put('chandelier', 0, 0, { diameter: 1.8, tiers: 2 }, 'Chandelier', 0, 5);
    // Two rings of supper tables round the bandstand, each with a chair, every other one with a lamp
    const tables: [number, number][] = [];
    ROW(10, (i) => { const a = (i / 10) * Math.PI * 2; tables.push([Math.sin(a) * 4.6, Math.cos(a) * 4.6]); });
    ROW(14, (i) => { const a = (i / 14) * Math.PI * 2 + 0.2; tables.push([Math.sin(a) * 6.6, Math.cos(a) * 6.6]); });
    for (const [x, z] of tables) {
      paint(put('table', x, z, { shape: 'round', diameter: 0.8, height: 0.75 }, 'Supper table'), '#f1e6d6', 0.8);
      paint(put('chair', x * 1.12, z * 1.12, {}, 'Chair', (Math.atan2(x, z) * 180) / Math.PI + 180), '#5a141a', 0.7);
    }
    tables.forEach(([x, z], i) => { if (i % 2 === 0) light('practical', [x, 0.75, z], { color: '#ffa04a', intensity: 70 }, true); });
    ROW(4, (i) => { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; light('fresnel', [Math.sin(a) * 6, 8, Math.cos(a) * 6], { color: '#ffc27a', intensity: 100, beam: 46, target: [Math.sin(a) * 2.5, 0.8, Math.cos(a) * 2.5] }); });
    ROW(3, (i) => { const a = (i / 3) * Math.PI * 2; light('fresnel', [Math.sin(a) * 9, 7, Math.cos(a) * 9], { color: '#ffa860', intensity: 100, beam: 56, target: [Math.sin(a) * 5.6, 0.8, Math.cos(a) * 5.6] }); });
    lightActions.setHaze({ on: true, density: 25 });
    const seat = (i: number): [number, number] => [tables[i][0] * 1.12, tables[i][1] * 1.12];
    cast(
      [
        ['Singer', 0.9, 0.9], ['Pianist', -0.4, 0.4], ['Bass', -1.9, 0.9],
        ['Guest 1', ...seat(2)], ['Guest 2', ...seat(7)], ['Guest 3', ...seat(14)],
        ['Waiter', 0, 5.65], ['Late guest', 9.5, 0],
      ],
      ['Pianist', 'Guest 1', 'Guest 2', 'Guest 3'],
    );
    // Follow the singer with a soft spot.
    const people = state().blockingByTemplate[state().templateId]?.performers ?? [];
    const singer = people.find((p) => p.name === 'Singer');
    light('profile', [6, 8, 6], { color: '#fff1dc', intensity: 100, beam: 12, target: [0.9, 1.6, 0.9], follow: singer?.id, name: 'Spot on Singer' });
    // The singer strolls round the bandstand; the waiter does a slow lap between the rings of tables;
    // a late guest comes in through the aisle and is shown to a table.
    const ring = (r: number, from: number, to: number, n: number): Pt[] => ROW(n + 1, (k) => { const a = from + ((to - from) * k) / n; return [Math.sin(a) * r, Math.cos(a) * r]; });
    walks([
      ['Singer', [[0.9, 0.9], [1.9, 0.2], [1.5, -1.3], [0.4, -1.8], [1.9, 0.2], [0.9, 0.9]], 2, 'slow', [{ index: 2, hold: 3 }, { index: 3, hold: 3 }]],
      ['Waiter', ring(5.65, 0, Math.PI * 1.5, 9), 0.5, 'slow', [{ index: 2, hold: 2 }, { index: 5, hold: 2 }]],
      ['Late guest', [[9.5, 0], [7.9, 0.2], [6.0, 1.0], seat(3)], 6, 'normal'],
    ]);
    looks('Late set');
    state().setOtherLayers('show');
  },
};

export const SHOWCASE_SCENES: ShowcaseScene[] = [stadium, arena, cabaret, sea, drawingRoom, farce, noir, jazz, keynote];
