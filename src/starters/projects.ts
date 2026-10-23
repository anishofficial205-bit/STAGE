/**
 * Example projects: one complete project per stage type that uses every
 * mode — a set, curtains or drapes where they fit, a venue around the stage
 * with rooms and named stage entrances, a lighting rig with looks, and a cast
 * with two blocked scenes. Built with the same actions a user would use, as
 * one undo step.
 */
import { useProjectStore } from '../store/useProjectStore';
import { getTemplate } from '../templates/registry';
import { STARTER_SETS } from '.';
import { addObjectAt, currentStage } from '../objects/actions';
import { addMaskingSets } from '../objects/curtains/masking';
import { venueActions } from '../venue/actions';
import { lightActions } from '../lighting/actions';
import { PRESET_LOOKS, fadeTo, lookActions } from '../lighting/looks';
import { blockingActions, blocking, currentScene, entranceMap, actingCentre } from '../blocking/actions';
import { stageSnapLines } from '../helpers/stageInfo';
import type { Pt as VPt } from '../venue/types';
import { shapeId, type DrawnShape } from '../templates/custom/shapes';
import { newId } from '../templates/blackBox/blocks';
import { useLightsUI } from '../lighting/ui';
import { useBlockingUI } from '../blocking/ui';
import { useVenueUI } from '../venue/ui';

export const EXAMPLES: Record<string, { title: string; cast: string[] }> = {
  proscenium: { title: 'Romeo and Juliet', cast: ['Juliet', 'Romeo', 'Nurse', 'Mercutio'] },
  'end-stage': { title: 'Product keynote', cast: ['Host', 'Guest speaker', 'Panellist'] },
  thrust: { title: 'Hamlet', cast: ['Hamlet', 'Ophelia', 'Horatio', 'Ghost'] },
  'in-the-round': { title: 'Arena concert', cast: ['Singer', 'Guitarist', 'Bassist', 'Drummer'] },
  traverse: { title: 'Fashion show', cast: ['Model 1', 'Model 2', 'Model 3', 'Model 4'] },
  'black-box': { title: 'Studio drama', cast: ['Anna', 'Ben', 'Clara'] },
  'open-air': { title: 'Summer festival', cast: ['Lead vocals', 'Guitar', 'Keys', 'Drums'] },
  custom: { title: 'Runway show', cast: ['Model 1', 'Model 2', 'Model 3'] },
};

/** A small backstage (green room, dressing room, corridor with stage doors) and a lobby out front. */
function buildVenue() {
  const s = useProjectStore.getState();
  const t = getTemplate(s.templateId)!;
  const b = t.bounds(s.paramsByTemplate[s.templateId], s.dataByTemplate[s.templateId]);
  const r = (v: number) => Math.round(v * 10) / 10;
  const [x0, x1, z0, z1] = [r(b.min[0]), r(b.max[0]), r(b.min[2]), r(b.max[2])];
  const back = z0 - 1;
  const w = Math.min(14, (x1 - x0) / 2);
  const cx = r((x0 + x1) / 2);
  // Backstage block behind the stage: a corridor along the stage, then green room and dressing room.
  venueActions.finishWalls([[cx - w, back - 8], [cx + w, back - 8], [cx + w, back], [cx - w, back], [cx - w, back - 8]]);
  venueActions.finishWalls([[cx - w, back - 2], [cx + w, back - 2]]);
  venueActions.finishWalls([[cx, back - 8], [cx, back - 2]]);
  venueActions.addRoomAt([cx, back - 1], 'corridor');
  venueActions.addRoomAt([cx - w / 2, back - 5], 'green-room');
  venueActions.addRoomAt([cx + w / 2, back - 5], 'dressing');
  venueActions.addRoomRect([cx - w, z1 + 1], [cx + w, z1 + 8], 'lobby');
  const green = useProjectStore.getState().venue.rooms.find((x) => x.type === 'green-room');
  const v = useProjectStore.getState().venue;
  const wallAt = (z: number, x: number) => v.walls.find((wl) => Math.abs(wl.a[1] - z) < 0.01 && Math.abs(wl.b[1] - z) < 0.01 && Math.min(wl.a[0], wl.b[0]) <= x && Math.max(wl.a[0], wl.b[0]) >= x);
  const door = (z: number, x: number, entrance?: string, preset: 'single' | 'double' = 'single') => {
    const wl = wallAt(z, x);
    if (!wl) return;
    const d = venueActions.addDoor(wl.id, Math.abs(x - wl.a[0]), preset, 1);
    if (entrance) venueActions.patchDoor(d.id, { entrance });
  };
  door(back, cx + w - 2, 'SL entrance', 'double');
  door(back, cx - w + 2, 'SR entrance', 'double');
  door(back - 2, cx - w / 2);
  door(back - 2, cx + w / 2);
  door(z1 + 1, cx - 3, undefined, 'double');
  door(z1 + 1, cx + 3, undefined, 'double');
  const fur = (type: string, at: VPt, rot = 0) => venueActions.addFurniture(type, at, rot);
  fur('sofa', [cx - w / 2, back - 7.3]);
  fur('dressing-table', [cx + w / 2 - 1.5, back - 7.4]);
  fur('dressing-table', [cx + w / 2 + 0.5, back - 7.4]);
  fur('costume-rack', [cx + w - 1.5, back - 4], -90);
  fur('ticket-counter', [cx, z1 + 7.2], 180);
  // A route from the green room to the stage, and one through the lobby to flag.
  const ents = useProjectStore.getState().venue.doors.filter((d) => d.entrance);
  if (green && ents[0]) venueActions.addRoute({ kind: 'room', id: green.id }, { kind: 'door', id: ents[1]?.id ?? ents[0].id });
  useVenueUI.getState().select(null);
}

/** A small rig (front wash, specials, cyc, PARs, house lights) and three looks, ending on `finalLook`. */
export function buildLights(finalLook = 'Warm evening') {
  lightActions.ensureReady();
  const s = useProjectStore.getState();
  const l = s.lightingByTemplate[s.templateId]!;
  const c = actingCentre();
  // A front wash, two specials, cyc lights and house lights.
  for (let i = 0; i < 4; i++) lightActions.addFixture('fresnel');
  for (let i = 0; i < 2; i++) lightActions.addFixture('profile');
  lightActions.addFixture('cyc');
  lightActions.addFixture('par');
  lightActions.addFixture('par');
  lightActions.addFixture('house');
  const fx = useProjectStore.getState().lightingByTemplate[s.templateId]!.fixtures;
  fx.filter((f) => f.type === 'fresnel').forEach((f, i) => lightActions.focus([f.id], [c[0] + (i - 1.5) * 2.5, f.target[1], c[1] + 1]));
  fx.filter((f) => f.type === 'profile').forEach((f, i) => lightActions.patch([f.id], { target: [c[0] + (i ? 2 : -2), f.target[1], c[1]], gobo: i ? undefined : 'leaves', purpose: i ? 'DSL special' : 'Garden breakup' }));
  void l;
  // Three looks, ending on the one asked for.
  for (const name of [...['Full stage wash', 'Cold night', 'Warm evening'].filter((n) => n !== finalLook), finalLook]) {
    const p = PRESET_LOOKS.find((x) => x.name === name)!;
    fadeTo(p.make(useProjectStore.getState().lightingByTemplate[s.templateId]!.fixtures), 0);
    lookActions.save(name);
  }
  useLightsUI.getState().select(null);
}

function buildBlocking(cast: string[]) {
  const ids = cast.map((name) => {
    const p = blockingActions.addPerformer();
    blockingActions.patchPerformers([p.id], { name });
    return p.id;
  });
  blockingActions.formation(ids, 'arc');
  const b = blocking();
  useProjectStore.getState().setBlocking((x) => ({ ...x, scenes: x.scenes.map((sc) => ({ ...sc, name: 'Opening', notes: 'Company in an arc; the first two cross downstage.' })) }));
  const ents = [...entranceMap(b).values()];
  const c = actingCentre();
  const [first, second] = ids;
  // The first performer crosses, pauses, and the second meets them centre.
  blockingActions.addPath(first, [[c[0] - 2, c[1] + 1.5], [c[0] - 0.6, c[1] + 2.2]], undefined, 1);
  const p1 = currentScene().paths[0];
  blockingActions.setStop(p1.id, 0, 2);
  blockingActions.addPath(second, [[c[0] + 2, c[1] + 1], [c[0] + 0.6, c[1] + 2.2]], undefined, 2);
  // Scene 2 starts where the opening ends; the others leave.
  blockingActions.duplicateScene(blocking().sceneId);
  useProjectStore.getState().setBlocking((x) => ({ ...x, scenes: x.scenes.map((sc) => (sc.id === x.sceneId ? { ...sc, name: 'Exits', notes: 'Everyone but the leads exits.' } : sc)) }));
  ids.slice(2).forEach((id, i) => {
    const e = ents[i % Math.max(1, ents.length)];
    if (e) blockingActions.addPath(id, [], e.id, 1 + i);
  });
  blockingActions.openScene(blocking().scenes[0].id);
  useBlockingUI.getState().select(null);
}

function buildCustomStage() {
  // A runway into a round stage, with seats along the runway.
  const runway: DrawnShape = { id: shapeId(), name: 'Runway', points: [{ x: -1, z: -2 }, { x: 1, z: -2 }, { x: 1, z: 7 }, { x: -1, z: 7 }], bulges: [0, 0, 0, 0], height: 0.6, edge: 'straight', material: 'white', radius: 0 };
  const stage: DrawnShape = { id: shapeId(), name: 'Main stage', points: [{ x: -4, z: -8 }, { x: 4, z: -8 }, { x: 4, z: -2 }, { x: -4, z: -2 }], bulges: [0, 0, 1.5, 0], height: 0.8, edge: 'stepped', material: 'black', radius: 0.6 };
  const seat = (x: number, z: number, rotation: number) => ({ id: newId(), kind: 'seating' as const, x, z, rotation, rows: 4, seatsPerRow: 14, rake: 0.25 });
  useProjectStore.getState().setData(() => ({ shapes: [stage, runway], blocks: [seat(-3.6, 2.5, 270), seat(3.6, 2.5, 90)] }));
}

/** Replace the project with the example for a stage type (one undo step). */
export function loadExampleProject(templateId: string) {
  const ex = EXAMPLES[templateId];
  const t = getTemplate(templateId);
  if (!ex || !t) return;
  const store = useProjectStore.getState();
  store.batch(`Opened the “${ex.title}” example`, () => {
    store.loadFile({ app: 'stage-builder', version: 2, projectName: ex.title, units: store.units, showLabels: true, templateId, mode: 'set' });
    if (templateId === 'custom') buildCustomStage();
    const set = STARTER_SETS[templateId]?.[0];
    if (set) useProjectStore.getState().loadStarterSet(set);
    if (currentStage().info.opening) {
      addObjectAt('main-curtain');
      useProjectStore.getState().updateObjects((l) => l.map((o) => (o.type === 'main-curtain' ? { ...o, params: { ...o.params, open: 100 } } : o)));
      addObjectAt('valance');
      addMaskingSets(3);
    } else if (['end-stage', 'black-box', 'open-air'].includes(templateId)) {
      const [, , , ] = stageSnapLines(currentStage().info).bounds;
      addObjectAt('cyc-cloth');
    }
    buildVenue();
    buildLights();
    buildBlocking(ex.cast);
    useProjectStore.getState().select([]);
  });
}
