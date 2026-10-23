/**
 * Starter scenes for the start screen ("What are you making?"): ready-made,
 * fully editable projects. Each is built with the same actions a user would
 * use, as one undo step, and named "… (Starter)" until the user renames it.
 */
import { useProjectStore, freshProject, newProjectId } from '../store/useProjectStore';
import { STARTER_SETS, type StarterPiece, type StarterSet } from '.';
import { addObjectAt, currentStage } from '../objects/actions';
import { addMaskingSets } from '../objects/curtains/masking';
import { buildLights } from './projects';
import { actingCentre, blockingActions } from '../blocking/actions';
import { useBlockingUI } from '../blocking/ui';
import type { Units } from '../units';

export interface StarterScene {
  id: string;
  title: string;
  blurb: string;
  /** Pre-rendered picture in /public/starters. */
  image: string;
  templateId: string;
  units?: Units;
  build: () => void;
}

const P = (type: string, x: number, z: number, params: StarterPiece['params'] = {}, extra: Partial<StarterPiece> = {}): StarterPiece => ({ type, x, z, params, ...extra });
const set = (id: string, name: string, pieces: StarterPiece[]): StarterSet => ({ id, name, description: name, pieces });
const fromLibrary = (templateId: string, setId: string) => STARTER_SETS[templateId]?.find((s) => s.id === setId);

function cast(names: string[], spread = 1.6) {
  const c = actingCentre();
  const ids = names.map((name) => {
    const p = blockingActions.addPerformer();
    blockingActions.patchPerformers([p.id], { name });
    return p.id;
  });
  blockingActions.setStart(ids, (_s, id) => ({ x: c[0] + (ids.indexOf(id) - (ids.length - 1) / 2) * spread, z: c[1], onStage: true, entrance: undefined }));
  useBlockingUI.getState().select(null);
}

/** Curtains and masking for stages with an arch, open so the set shows. */
function dressArch() {
  if (!currentStage().info.opening) return;
  addObjectAt('main-curtain');
  useProjectStore.getState().updateObjects((l) => l.map((o) => (o.type === 'main-curtain' ? { ...o, params: { ...o.params, open: 100 } } : o)));
  addObjectAt('valance');
  addMaskingSets(2);
}

function tint(names: string[], color: string) {
  useProjectStore.getState().updateObjects((l) => l.map((o) => (names.includes(o.name) ? { ...o, faces: { ...o.faces, '*': { material: 'paint', color, roughness: 0.85 } } } : o)));
}

export const STARTER_SCENES: StarterScene[] = [
  {
    id: 'play',
    title: 'A play',
    blurb: 'Proscenium stage, a living-room set, warm lights and two performers.',
    image: 'starters/play.jpg',
    templateId: 'proscenium',
    build: () => {
      const living = fromLibrary('proscenium', 'living-room');
      if (living) useProjectStore.getState().loadStarterSet({ ...living, pieces: living.pieces.filter((p) => p.type !== 'person-standing') });
      dressArch();
      buildLights('Warm evening');
      cast(['Ana', 'Ben']);
    },
  },
  {
    id: 'concert',
    title: 'A concert',
    blurb: 'Open-air stage with a truss roof, an LED wall and concert lighting.',
    image: 'starters/concert.jpg',
    templateId: 'open-air',
    build: () => {
      const band = fromLibrary('open-air', 'festival-band');
      if (band) useProjectStore.getState().loadStarterSet({ ...band, pieces: band.pieces.filter((p) => p.type !== 'fixture') });
      buildLights('Concert');
    },
  },
  {
    id: 'wedding',
    title: 'A wedding',
    blurb: 'End stage with a mandap, a floral backdrop and warm lighting. Sizes in feet.',
    image: 'starters/wedding.jpg',
    templateId: 'end-stage',
    units: 'ft',
    build: () => {
      const corner = (x: number, z: number, i: number) => P('column', x, z, { shape: 'round', diameter: 0.25, height: 2.8, baseCapital: true }, { name: `Mandap pillar ${i}` });
      useProjectStore.getState().loadStarterSet(
        set('wedding', 'Wedding', [
          P('backdrop', 0, -3.4, { width: 7, height: 4 }, { name: 'Floral backdrop' }),
          P('platform', 0, -1.2, { width: 3.4, depth: 3.4, heightPreset: 'custom', customHeight: 0.2 }, { name: 'Mandap floor' }),
          corner(-1.5, -2.7, 1),
          corner(1.5, -2.7, 2),
          corner(-1.5, 0.3, 3),
          corner(1.5, 0.3, 4),
          P('box', 0, -1.2, { width: 3.4, depth: 3.4, height: 0.15 }, { name: 'Mandap canopy', elevation: 2.95 }),
          P('chair', -0.5, -1.2, { style: 'armchair' }, { rotation: 180, name: 'Chair 1', elevation: 0.2 }),
          P('chair', 0.5, -1.2, { style: 'armchair' }, { rotation: 180, name: 'Chair 2', elevation: 0.2 }),
          P('plant', -2.4, -2.6, { height: 1.5 }, { name: 'Flowers left' }),
          P('plant', 2.4, -2.6, { height: 1.5 }, { name: 'Flowers right' }),
          P('plant', -2.2, 0.8, { height: 0.9, pot: 0.3 }, { name: 'Flowers front left' }),
          P('plant', 2.2, 0.8, { height: 0.9, pot: 0.3 }, { name: 'Flowers front right' }),
        ]),
      );
      tint(['Floral backdrop'], '#e7b8bd');
      tint(['Mandap canopy', 'Mandap floor'], '#f1d9a8');
      tint(['Mandap pillar 1', 'Mandap pillar 2', 'Mandap pillar 3', 'Mandap pillar 4'], '#f4ead8');
      buildLights('Warm evening');
    },
  },
  {
    id: 'corporate',
    title: 'A corporate event',
    blurb: 'End stage with a podium, an LED wall and clean, even lighting.',
    image: 'starters/corporate.jpg',
    templateId: 'end-stage',
    build: () => {
      useProjectStore.getState().loadStarterSet(
        set('corporate', 'Corporate event', [
          P('led-wall', 0, -3.3, { panelsWide: 14, panelsHigh: 7 }, { name: 'LED wall', elevation: 0.4 }),
          P('lectern', 3.4, 0.6, { width: 0.7 }, { rotation: -20, name: 'Podium' }),
          P('chair', -4.4, 0.8, { style: 'armchair' }, { rotation: 20, name: 'Panel chair 1' }),
          P('chair', -3.2, 1.2, { style: 'armchair' }, { rotation: 8, name: 'Panel chair 2' }),
          P('table', -3.8, 1.9, { shape: 'round', diameter: 0.6, height: 0.5 }, { name: 'Side table' }),
          P('plant', -5.6, -2.8, { height: 1.6 }),
          P('plant', 5.6, -2.8, { height: 1.6 }),
        ]),
      );
      buildLights('Full stage wash');
    },
  },
  {
    id: 'fashion',
    title: 'A fashion show',
    blurb: 'A runway with seating on both sides and bright white light.',
    image: 'starters/fashion.jpg',
    templateId: 'traverse',
    build: () => {
      const show = fromLibrary('traverse', 'fashion-show');
      if (show) useProjectStore.getState().loadStarterSet({ ...show, pieces: show.pieces.filter((p) => p.type !== 'person-standing') });
      buildLights('Full stage wash');
      cast(['Model 1', 'Model 2'], 0.9);
    },
  },
  {
    id: 'scratch',
    title: 'Start from scratch',
    blurb: 'An empty proscenium stage. Nothing else.',
    image: 'starters/scratch.jpg',
    templateId: 'proscenium',
    build: () => {},
  },
];

/** Open a starter scene as a new project (one undo step). */
export function loadStarterScene(id: string) {
  const scene = STARTER_SCENES.find((s) => s.id === id);
  if (!scene) return;
  const store = useProjectStore.getState();
  const base = freshProject();
  const name = scene.id === 'scratch' ? 'Untitled stage' : `${scene.title.replace(/^An? /, '').replace(/^./, (c) => c.toUpperCase())} (Starter)`;
  store.batch(`Started “${scene.title}”`, () => {
    store.loadFile({ ...base, app: 'stage-builder', version: 2, projectId: newProjectId(), projectName: name, units: scene.units ?? base.units, templateId: scene.templateId, mode: 'stage' });
    scene.build();
    useProjectStore.getState().select([]);
    useProjectStore.getState().setMode('stage');
  });
  useProjectStore.getState().save();
}
